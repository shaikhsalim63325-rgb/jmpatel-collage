import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { toCommitteeSlug } from '../data/committees';
import {
  auth,
  db,
  getProvisioningAuth,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import type {
  AdminAnalytics,
  Committee,
  DocumentItem,
  EventItem,
  GalleryItem,
  LoginLog,
  Notice,
  Profile,
  UserRole,
} from '../types/portal';

let cachedProfile: Profile | null = null;

function safeString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return '';
}

function safeNullableString(val: unknown): string | null {
  const s = safeString(val).trim();
  return s.length > 0 ? s : null;
}

function safeTimestampToIso(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  try {
    if (
      typeof val === 'object' &&
      'toDate' in val &&
      typeof (val as { toDate: () => Date }).toDate === 'function'
    ) {
      const d = (val as { toDate: () => Date }).toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
    }
    if (
      typeof val === 'object' &&
      'seconds' in val &&
      typeof (val as { seconds: unknown }).seconds === 'number'
    ) {
      const d = new Date((val as { seconds: number }).seconds * 1000);
      return !Number.isNaN(d.getTime()) ? d.toISOString() : null;
    }
    if (val instanceof Date) {
      return !Number.isNaN(val.getTime()) ? val.toISOString() : null;
    }
    if (typeof val === 'number') {
      const d = new Date(val);
      return !Number.isNaN(d.getTime()) ? d.toISOString() : null;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return null;
      const d = new Date(trimmed);
      return !Number.isNaN(d.getTime()) ? d.toISOString() : trimmed;
    }
  } catch (err) {
    console.error('Failed to convert Firestore timestamp:', err);
  }
  return null;
}

function toIsoString(val: unknown): string {
  return safeTimestampToIso(val) ?? new Date().toISOString();
}

export function extractReadableErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || 'Unknown error');
  let extracted = raw;
  let pathHint = '';
  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { error?: string; path?: string };
      if (parsed.error) extracted = parsed.error;
      if (parsed.path) pathHint = parsed.path;
    } catch {
      // keep raw message
    }
  }
  const code = (error as { code?: string })?.code || '';
  const isPermission =
    code === 'permission-denied' ||
    extracted.toLowerCase().includes('permission') ||
    extracted.toLowerCase().includes('insufficient permissions');

  if (isPermission) {
    return `Permission denied${pathHint ? ` (${pathHint})` : ''}: Student/User ko Firestore rules me notices padhne ki permission nahi mili. Details: ${extracted}`;
  }
  return extracted;
}

function normalizeRole(rawRole: unknown): UserRole {
  const val = String(rawRole || '').trim().toLowerCase();
  if (val === 'admin') return 'admin';
  if (val === 'committee' || val === 'committee_member') return 'committee_member';
  return 'student';
}

function toFirestoreRole(role: UserRole): 'admin' | 'committee' | 'student' {
  if (role === 'admin') return 'admin';
  if (role === 'committee_member') return 'committee';
  return 'student';
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapUserDoc(id: string, data: DocumentData): Profile {
  const committeeVal = data.committeeId ?? data.committee_id;
  const activeVal = data.isActive ?? data.is_active;
  const mustChangeVal = data.mustChangePassword ?? data.must_change_password;
  const createdVal = data.createdAt ?? data.created_at;

  return {
    id,
    name: String(data.name || data.email || 'College User'),
    email: data.email ? String(data.email) : null,
    role: normalizeRole(data.role),
    committee_id: committeeVal ? String(committeeVal) : null,
    is_active: activeVal === undefined ? true : Boolean(activeVal),
    must_change_password: Boolean(mustChangeVal),
    created_at: toIsoString(createdVal),
  };
}

function mapFirebaseAuthError(
  err: unknown,
  context: 'login' | 'register' | 'password' | 'reset' | 'setup'
): string {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not enabled yet in Firebase Console → Authentication → Sign-in method.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    if (context === 'reset') {
      return 'No account was found with this email address.';
    }
    return 'Invalid email or password.';
  }
  if (code === 'auth/email-already-in-use') {
    return context === 'setup'
      ? 'This email or Principal account is already registered.'
      : 'An account with this email already exists.';
  }
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters long.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment before trying again.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'Please sign out and sign back in once before changing your password.';
  }
  return err instanceof Error ? err.message : 'Authentication request failed.';
}

function waitForAuthUser(): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function bootstrapPrincipalRecords(
  user: User,
  displayName = 'College Principal'
): Promise<Profile> {
  const uid = user.uid;
  const cleanName = displayName.trim().slice(0, 120) || 'College Principal';
  const cleanEmail = user.email ? user.email.trim().toLowerCase().slice(0, 160) : null;
  const batch = writeBatch(db);

  batch.set(doc(db, 'admins', 'principal_lock'), {
    uid,
    created_at: serverTimestamp(),
  });
  batch.set(doc(db, 'admins', uid), {
    uid,
    created_at: serverTimestamp(),
  });
  batch.set(doc(db, 'users', uid), {
    uid,
    name: cleanName,
    email: cleanEmail,
    role: 'admin',
    committeeId: null,
    is_active: true,
    must_change_password: false,
    created_at: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }

  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    throw new Error('Principal profile could not be initialized.');
  }
  return mapUserDoc(snap.id, snap.data());
}

async function recordLoginLog(profile: Profile): Promise<void> {
  const path = 'loginLogs';
  try {
    await addDoc(collection(db, path), {
      userId: profile.id,
      role: toFirestoreRole(profile.role),
      committeeId: profile.committee_id ?? null,
      loggedInAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

async function compressImageToDataUrl(file: File): Promise<string> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode image.'));
      el.src = bitmapUrl;
    });

    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of [0.8, 0.65, 0.5, 0.35]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= 850000) {
        return dataUrl;
      }
    }
    throw new Error('Image is too large even after compression. Please choose a smaller image.');
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// AUTHENTICATION
// ---------------------------------------------------------------------------

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await waitForAuthUser();
  if (!user) {
    cachedProfile = null;
    return null;
  }

  const userPath = `users/${user.uid}`;
  let snap;
  try {
    snap = await getDoc(doc(db, 'users', user.uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!snap.exists()) {
    await signOut(auth);
    cachedProfile = null;
    return null;
  }

  const profile = mapUserDoc(snap.id, snap.data());
  if (!profile.is_active) {
    await signOut(auth);
    cachedProfile = null;
    return null;
  }

  cachedProfile = profile;
  return profile;
}

export async function setupPrincipalAccount(
  name: string,
  email: string,
  password: string
): Promise<Profile> {
  const trimmedName = name.trim().slice(0, 120) || 'College Principal';
  const normalizedEmail = email.trim().toLowerCase().slice(0, 160);
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new Error('Please enter a valid Principal email address.');
  }
  if (password.length < 8) {
    throw new Error('Principal password must be at least 8 characters long.');
  }

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error, 'setup'));
  }

  try {
    const profile = await bootstrapPrincipalRecords(credential.user, trimmedName);
    cachedProfile = profile;
    await recordLoginLog(profile);
    return profile;
  } catch (err) {
    await credential.user.delete().catch(() => signOut(auth).catch(() => undefined));
    const msg = extractReadableErrorMessage(err);
    if (msg.toLowerCase().includes('permission')) {
      throw new Error(
        'Principal account is already initialized. Please sign in with the registered Principal email.'
      );
    }
    throw err;
  }
}

export async function loginWithEmail(email: string, password: string): Promise<Profile> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error('Email and password are required.');
  }
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  let credential;
  try {
    credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error, 'login'));
  }

  const uid = credential.user.uid;
  const userPath = `users/${uid}`;
  let snap;
  try {
    snap = await getDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!snap.exists()) {
    await signOut(auth);
    throw new Error(`Account profile (users/${uid}) not found. Please contact the Principal.`);
  }

  const profile = mapUserDoc(snap.id, snap.data());
  if (!profile.is_active) {
    await signOut(auth);
    cachedProfile = null;
    throw new Error('This account has been disabled by the Principal.');
  }

  cachedProfile = profile;
  await recordLoginLog(profile);
  return profile;
}

export async function sendResetPasswordEmail(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
    throw new Error('Please enter a valid registered email address.');
  }

  try {
    await sendPasswordResetEmail(auth, normalizedEmail);
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error, 'reset'));
  }
}

export async function registerStudent(
  name: string,
  email: string,
  password: string
): Promise<Profile> {
  const trimmedName = name.trim().slice(0, 120);
  const normalizedEmail = email.trim().toLowerCase().slice(0, 160);
  if (!trimmedName || !normalizedEmail || !password) {
    throw new Error('Full name, email, and password are required.');
  }
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error, 'register'));
  }

  const uid = credential.user.uid;
  const userPath = `users/${uid}`;
  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      name: trimmedName,
      email: normalizedEmail,
      role: 'student',
      committeeId: null,
      is_active: true,
      must_change_password: false,
      created_at: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  const snap = await getDoc(doc(db, 'users', uid));
  const profile: Profile = snap.exists()
    ? mapUserDoc(snap.id, snap.data())
    : {
        id: uid,
        name: trimmedName,
        email: normalizedEmail,
        role: 'student',
        committee_id: null,
        is_active: true,
        must_change_password: false,
        created_at: new Date().toISOString(),
      };

  cachedProfile = profile;
  await recordLoginLog(profile);
  return profile;
}

export async function changePassword(newPassword: string): Promise<Profile> {
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Your session expired. Please sign in again.');
  }

  try {
    await updatePassword(user, newPassword);
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error, 'password'));
  }

  const userPath = `users/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      must_change_password: false,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  const snap = await getDoc(doc(db, 'users', user.uid));
  const updated = snap.exists()
    ? mapUserDoc(snap.id, snap.data())
    : { ...cachedProfile!, must_change_password: false };
  cachedProfile = updated;
  return updated;
}

export async function logout(): Promise<void> {
  cachedProfile = null;
  await signOut(auth);
}

// ---------------------------------------------------------------------------
// COMMITTEES (Dynamic from Firestore — Admin manages)
// ---------------------------------------------------------------------------

export async function fetchCommittees(): Promise<Committee[]> {
  const path = 'committees';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          name: String(data.name || ''),
          description: String(data.description || ''),
          logo_url: data.logo_url ? String(data.logo_url) : null,
          department_group: data.department_group ? String(data.department_group) : undefined,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function encodeCommitteeLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Committee logo must be an image file (PNG, JPG, WebP).');
  }
  return compressImageToDataUrl(file);
}

export async function createCommittee(payload: {
  name: string;
  description: string;
  logo_url?: string | null;
  department_group?: string;
}): Promise<Committee> {
  const trimmedName = payload.name.trim().slice(0, 80);
  const trimmedDesc = payload.description.trim().slice(0, 600);
  const deptGroup = payload.department_group?.trim().slice(0, 80) || 'Campus Committee';
  const logoUrl = payload.logo_url ? String(payload.logo_url).trim().slice(0, 900000) : null;

  if (!trimmedName || !trimmedDesc) {
    throw new Error('Committee name and description are required.');
  }

  let slug = toCommitteeSlug(trimmedName);
  try {
    const existingSnap = await getDoc(doc(db, 'committees', slug));
    if (existingSnap.exists()) {
      slug = `${slug.slice(0, 56)}-${Date.now().toString(36).slice(-4)}`;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `committees/${slug}`);
  }

  const docPath = `committees/${slug}`;
  try {
    await setDoc(doc(db, 'committees', slug), {
      id: slug,
      name: trimmedName,
      description: trimmedDesc,
      department_group: deptGroup,
      logo_url: logoUrl,
      created_at: serverTimestamp(),
    });
    return {
      id: slug,
      name: trimmedName,
      description: trimmedDesc,
      department_group: deptGroup,
      logo_url: logoUrl,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function updateCommittee(
  id: string,
  payload: {
    name: string;
    description: string;
    logo_url?: string | null;
    department_group?: string;
  }
): Promise<Committee> {
  const trimmedName = payload.name.trim().slice(0, 80);
  const trimmedDesc = payload.description.trim().slice(0, 600);
  const deptGroup = payload.department_group?.trim().slice(0, 80) || 'Campus Committee';
  if (!trimmedName || !trimmedDesc) {
    throw new Error('Committee name and description are required.');
  }

  const docPath = `committees/${id}`;
  const updateBody: Record<string, unknown> = {
    name: trimmedName,
    description: trimmedDesc,
    department_group: deptGroup,
  };
  if (payload.logo_url !== undefined) {
    updateBody.logo_url = payload.logo_url ? String(payload.logo_url).trim().slice(0, 900000) : null;
  }

  try {
    await updateDoc(doc(db, 'committees', id), updateBody);
    const snap = await getDoc(doc(db, 'committees', id));
    const data = snap.data() || {};
    return {
      id,
      name: String(data.name || trimmedName),
      description: String(data.description || trimmedDesc),
      department_group: data.department_group ? String(data.department_group) : deptGroup,
      logo_url: data.logo_url ? String(data.logo_url) : null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteCommittee(id: string): Promise<void> {
  const docPath = `committees/${id}`;
  try {
    await deleteDoc(doc(db, 'committees', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// ---------------------------------------------------------------------------
// NOTICES
// ---------------------------------------------------------------------------

function extractNoticeAttachment(data: DocumentData | undefined): {
  file_url: string | null;
  file_name: string | null;
} {
  if (!data || typeof data !== 'object') {
    return { file_url: null, file_name: null };
  }
  const rawFile = data.file_url ?? data.fileUrl ?? data.file;
  let file_url: string | null = null;
  let file_name: string | null = safeNullableString(data.file_name ?? data.fileName);

  if (typeof rawFile === 'string') {
    file_url = safeNullableString(rawFile);
  } else if (rawFile && typeof rawFile === 'object') {
    const fileObj = rawFile as Record<string, unknown>;
    file_url = safeNullableString(fileObj.url ?? fileObj.file_url ?? fileObj.fileUrl);
    if (!file_name) {
      file_name = safeNullableString(fileObj.name ?? fileObj.file_name ?? fileObj.fileName);
    }
  }

  return { file_url, file_name };
}

function mapNoticeDoc(id: string, data: DocumentData | undefined): Notice {
  const safeData = data && typeof data === 'object' ? data : {};
  const { file_url, file_name } = extractNoticeAttachment(safeData);

  return {
    id: safeString(id),
    committee_id: safeString(safeData.committee_id ?? safeData.committeeId).trim(),
    title: safeString(safeData.title).trim(),
    description: safeString(safeData.description),
    file_url,
    file_name,
    created_by: safeNullableString(safeData.created_by ?? safeData.createdBy),
    created_at: safeTimestampToIso(safeData.created_at ?? safeData.createdAt),
  };
}

export async function fetchNotices(): Promise<Notice[]> {
  const path = 'notices';
  const active = cachedProfile ?? (await getCurrentProfile());
  try {
    const q =
      active?.role === 'committee_member' && active.committee_id
        ? query(collection(db, path), where('committee_id', '==', active.committee_id))
        : collection(db, path);
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapNoticeDoc(d.id, d.data()))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  } catch (error) {
    console.error('fetchNotices failed:', error);
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchNoticeById(noticeId: string): Promise<Notice> {
  const cleanId = safeString(noticeId).trim();
  if (!cleanId) {
    throw new Error('Invalid notice ID.');
  }
  const path = `notices/${cleanId}`;
  try {
    const snap = await getDoc(doc(db, 'notices', cleanId));
    if (!snap.exists()) {
      throw new Error('Notice not found or may have been deleted.');
    }
    return mapNoticeDoc(snap.id, snap.data());
  } catch (error) {
    console.error(`fetchNoticeById(${cleanId}) failed:`, error);
    if (error instanceof Error && error.message === 'Notice not found or may have been deleted.') {
      throw error;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createNotice(payload: {
  committee_id: string;
  title: string;
  description: string;
  file_url?: string | null;
  file_name?: string | null;
}): Promise<Notice> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Authentication required to publish a notice.');
  const path = 'notices';

  const cleanPayload = {
    committee_id: payload.committee_id.trim().slice(0, 64),
    title: payload.title.trim().slice(0, 200),
    description: payload.description.trim().slice(0, 4000),
    file_url: payload.file_url ? String(payload.file_url).slice(0, 900000) : null,
    file_name: payload.file_name ? String(payload.file_name).trim().slice(0, 200) : null,
    created_by: uid,
    created_at: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, path), cleanPayload);
    return {
      id: docRef.id,
      committee_id: cleanPayload.committee_id,
      title: cleanPayload.title,
      description: cleanPayload.description,
      file_url: cleanPayload.file_url,
      file_name: cleanPayload.file_name,
      created_by: uid,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateNotice(
  id: string,
  payload: { title: string; description: string; file_url?: string | null; file_name?: string | null }
): Promise<Notice> {
  const path = `notices/${id}`;
  const updateBody: Record<string, unknown> = {
    title: payload.title.trim().slice(0, 200),
    description: payload.description.trim().slice(0, 4000),
  };
  if (payload.file_url !== undefined) {
    updateBody.file_url = payload.file_url ? String(payload.file_url).slice(0, 900000) : null;
  }
  if (payload.file_name !== undefined) {
    updateBody.file_name = payload.file_name ? String(payload.file_name).trim().slice(0, 200) : null;
  }

  try {
    await updateDoc(doc(db, 'notices', id), updateBody);
    const snap = await getDoc(doc(db, 'notices', id));
    return mapNoticeDoc(id, snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNotice(id: string): Promise<void> {
  const path = `notices/${id}`;
  try {
    await deleteDoc(doc(db, 'notices', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// EVENTS
// ---------------------------------------------------------------------------

export async function fetchEvents(): Promise<EventItem[]> {
  const path = 'events';
  const active = cachedProfile ?? (await getCurrentProfile());
  try {
    const q =
      active?.role === 'committee_member' && active.committee_id
        ? query(collection(db, path), where('committee_id', '==', active.committee_id))
        : collection(db, path);
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          committee_id: String(data.committee_id || ''),
          title: String(data.title || ''),
          description: String(data.description || ''),
          date: String(data.date || ''),
          venue: String(data.venue || ''),
          created_by: data.created_by ? String(data.created_by) : null,
          created_at: toIsoString(data.created_at),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createEvent(payload: {
  committee_id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
}): Promise<EventItem> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Authentication required to schedule an event.');
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(payload.date.trim())) {
    throw new Error('Event date must be in YYYY-MM-DD format.');
  }

  const path = 'events';
  const cleanPayload = {
    committee_id: payload.committee_id.trim().slice(0, 64),
    title: payload.title.trim().slice(0, 200),
    description: payload.description.trim().slice(0, 4000),
    date: payload.date.trim(),
    venue: payload.venue.trim().slice(0, 200),
    created_by: uid,
    created_at: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, path), cleanPayload);
    return {
      id: docRef.id,
      committee_id: cleanPayload.committee_id,
      title: cleanPayload.title,
      description: cleanPayload.description,
      date: cleanPayload.date,
      venue: cleanPayload.venue,
      created_by: uid,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateEvent(
  id: string,
  payload: { title: string; description: string; date: string; venue: string }
): Promise<EventItem> {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(payload.date.trim())) {
    throw new Error('Event date must be in YYYY-MM-DD format.');
  }
  const path = `events/${id}`;
  const updateBody = {
    title: payload.title.trim().slice(0, 200),
    description: payload.description.trim().slice(0, 4000),
    date: payload.date.trim(),
    venue: payload.venue.trim().slice(0, 200),
  };

  try {
    await updateDoc(doc(db, 'events', id), updateBody);
    const snap = await getDoc(doc(db, 'events', id));
    const data = snap.data() || {};
    return {
      id,
      committee_id: String(data.committee_id || ''),
      title: String(data.title || updateBody.title),
      description: String(data.description || updateBody.description),
      date: String(data.date || updateBody.date),
      venue: String(data.venue || updateBody.venue),
      created_by: data.created_by ? String(data.created_by) : null,
      created_at: toIsoString(data.created_at),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteEvent(id: string): Promise<void> {
  const path = `events/${id}`;
  try {
    await deleteDoc(doc(db, 'events', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// GALLERY
// ---------------------------------------------------------------------------

export async function fetchGallery(): Promise<GalleryItem[]> {
  const path = 'gallery';
  const active = cachedProfile ?? (await getCurrentProfile());
  try {
    const q =
      active?.role === 'committee_member' && active.committee_id
        ? query(collection(db, path), where('committee_id', '==', active.committee_id))
        : collection(db, path);
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          committee_id: String(data.committee_id || ''),
          image_url: String(data.image_url || ''),
          caption: String(data.caption || ''),
          created_at: toIsoString(data.created_at),
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createGalleryItem(payload: {
  committee_id: string;
  image_url: string;
  caption: string;
}): Promise<GalleryItem> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Authentication required to upload gallery photos.');
  const path = 'gallery';
  const cleanPayload = {
    committee_id: payload.committee_id.trim().slice(0, 64),
    image_url: payload.image_url.trim().slice(0, 900000),
    caption: payload.caption.trim().slice(0, 400),
    created_by: uid,
    created_at: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, path), cleanPayload);
    return {
      id: docRef.id,
      committee_id: cleanPayload.committee_id,
      image_url: cleanPayload.image_url,
      caption: cleanPayload.caption,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteGalleryItem(id: string): Promise<void> {
  const path = `gallery/${id}`;
  try {
    await deleteDoc(doc(db, 'gallery', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// DOCUMENTS (Committee Member own + Admin all)
// ---------------------------------------------------------------------------

export async function fetchDocuments(): Promise<DocumentItem[]> {
  const path = 'documents';
  const active = cachedProfile ?? (await getCurrentProfile());
  try {
    const q =
      active?.role === 'committee_member' && active.committee_id
        ? query(collection(db, path), where('committee_id', '==', active.committee_id))
        : collection(db, path);
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          committee_id: String(data.committee_id || ''),
          title: String(data.title || ''),
          file_url: String(data.file_url || ''),
          file_name: data.file_name ? String(data.file_name) : null,
          created_at: toIsoString(data.created_at),
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createDocument(payload: {
  committee_id: string;
  title: string;
  file_url: string;
  file_name?: string | null;
}): Promise<DocumentItem> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Authentication required to upload documents.');
  const path = 'documents';
  const cleanPayload = {
    committee_id: payload.committee_id.trim().slice(0, 64),
    title: payload.title.trim().slice(0, 200),
    file_url: payload.file_url.trim().slice(0, 900000),
    file_name: payload.file_name ? String(payload.file_name).trim().slice(0, 200) : null,
    created_by: uid,
    created_at: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, path), cleanPayload);
    return {
      id: docRef.id,
      committee_id: cleanPayload.committee_id,
      title: cleanPayload.title,
      file_url: cleanPayload.file_url,
      file_name: cleanPayload.file_name,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteDocument(id: string): Promise<void> {
  const path = `documents/${id}`;
  try {
    await deleteDoc(doc(db, 'documents', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// CLIENT-SIDE FILE ENCODING (Firebase Storage disabled per request)
// ---------------------------------------------------------------------------

export async function uploadCommitteeFile(
  _committeeId: string,
  _folder: 'notices' | 'gallery' | 'documents',
  file: File
): Promise<{ url: string; fileName: string }> {
  if (file.type.startsWith('image/')) {
    const compressedUrl = await compressImageToDataUrl(file);
    return { url: compressedUrl, fileName: file.name.slice(0, 200) };
  }

  if (file.size <= 600 * 1024) {
    const dataUrl = await fileToDataUrl(file);
    if (dataUrl.length <= 880000) {
      return { url: dataUrl, fileName: file.name.slice(0, 200) };
    }
  }

  throw new Error(
    'Firebase Storage is currently disabled. Please upload an image or a PDF/document under 600 KB.'
  );
}

// ---------------------------------------------------------------------------
// ADMIN PANEL (Principal Only)
// ---------------------------------------------------------------------------

export async function fetchCommitteeMembers(): Promise<Profile[]> {
  const path = 'users';
  try {
    const q = query(collection(db, path), where('role', 'in', ['committee', 'committee_member']));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapUserDoc(d.id, d.data()))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createCommitteeMember(payload: {
  name: string;
  email: string;
  password: string;
  committee_id: string;
}): Promise<Profile> {
  const trimmedName = payload.name.trim().slice(0, 120);
  const normalizedEmail = payload.email.trim().toLowerCase().slice(0, 160);
  const password = payload.password;
  const committeeId = payload.committee_id.trim();

  if (!trimmedName || !normalizedEmail || !password || !committeeId) {
    throw new Error('Name, email, temporary password, and committee are required.');
  }
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new Error('Please enter a valid email address for the committee member.');
  }
  if (password.length < 8) {
    throw new Error('Temporary password must be at least 8 characters long.');
  }

  try {
    const committeeSnap = await getDoc(doc(db, 'committees', committeeId));
    if (!committeeSnap.exists()) {
      throw new Error('Selected committee does not exist. Please add the committee first.');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('does not exist')) throw err;
    handleFirestoreError(err, OperationType.GET, `committees/${committeeId}`);
  }

  try {
    const dupSnap = await getDocs(
      query(collection(db, 'users'), where('email', '==', normalizedEmail))
    );
    if (!dupSnap.empty) {
      throw new Error(`Email "${normalizedEmail}" is already registered.`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('already registered')) throw err;
    handleFirestoreError(err, OperationType.LIST, 'users');
  }

  const secondaryAuth = getProvisioningAuth();

  let newUid: string;
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, password);
    newUid = cred.user.uid;
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error, 'register'));
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
  }

  const userPath = `users/${newUid}`;
  try {
    await setDoc(doc(db, 'users', newUid), {
      uid: newUid,
      name: trimmedName,
      email: normalizedEmail,
      role: 'committee',
      committeeId,
      is_active: true,
      must_change_password: true,
      created_at: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  const snap = await getDoc(doc(db, 'users', newUid));
  if (snap.exists()) {
    return mapUserDoc(snap.id, snap.data());
  }
  return {
    id: newUid,
    name: trimmedName,
    email: normalizedEmail,
    role: 'committee_member',
    committee_id: committeeId,
    is_active: true,
    must_change_password: true,
    created_at: new Date().toISOString(),
  };
}

export async function toggleMemberActive(userId: string, isActive: boolean): Promise<Profile> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      is_active: isActive,
    });
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) throw new Error('Committee member not found.');
    return mapUserDoc(snap.id, snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function resetMemberPassword(userId: string): Promise<Profile> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      must_change_password: true,
    });
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) throw new Error('Committee member not found.');
    return mapUserDoc(snap.id, snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCommitteeMember(userId: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchAdminAnalytics(committees: Committee[]): Promise<AdminAnalytics> {
  try {
    const [logsSnap, usersSnap, noticesSnap, eventsSnap, gallerySnap, docsSnap] = await Promise.all([
      getDocs(collection(db, 'loginLogs')).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'loginLogs')
      ),
      getDocs(collection(db, 'users')).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'users')
      ),
      getDocs(collection(db, 'notices')).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'notices')
      ),
      getDocs(collection(db, 'events')).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'events')
      ),
      getDocs(collection(db, 'gallery')).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'gallery')
      ),
      getDocs(collection(db, 'documents')).catch((e) =>
        handleFirestoreError(e, OperationType.LIST, 'documents')
      ),
    ]);

    const logs: LoginLog[] = logsSnap.docs
      .map((d) => {
        const data = d.data();
        const userIdVal = data.userId ?? data.user_id ?? '';
        const committeeVal = data.committeeId ?? data.committee_id ?? null;
        const loggedAtVal = data.loggedInAt ?? data.logged_in_at;
        return {
          id: d.id,
          user_id: String(userIdVal),
          user_name: data.userName ?? data.user_name ? String(data.userName ?? data.user_name) : undefined,
          user_email: data.userEmail ?? data.user_email ?? data.email ? String(data.userEmail ?? data.user_email ?? data.email) : null,
          role: normalizeRole(data.role),
          committee_id: committeeVal ? String(committeeVal) : null,
          logged_in_at: toIsoString(loggedAtVal),
        };
      })
      .sort((a, b) => b.logged_in_at.localeCompare(a.logged_in_at));

    const profiles = usersSnap.docs.map((d) => mapUserDoc(d.id, d.data()));
    const notices = noticesSnap.docs.map((d) => d.data());
    const events = eventsSnap.docs.map((d) => d.data());
    const gallery = gallerySnap.docs.map((d) => d.data());
    const docs = docsSnap.docs.map((d) => d.data());

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 86400 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 86400 * 1000;

    const total_students_logged_in = new Set(
      logs.filter((l) => l.role === 'student').map((l) => l.user_id)
    ).size;
    const total_committee_members_logged_in = new Set(
      logs.filter((l) => l.role === 'committee_member').map((l) => l.user_id)
    ).size;

    let logins_today = 0;
    let logins_this_week = 0;
    let logins_this_month = 0;

    for (const log of logs) {
      const t = new Date(log.logged_in_at).getTime();
      if (t >= startOfToday) logins_today++;
      if (t >= sevenDaysAgo) logins_this_week++;
      if (t >= thirtyDaysAgo) logins_this_month++;
    }

    const dailyMap = new Map<string, { students: number; committee_members: number }>();
    for (let d = 13; d >= 0; d--) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - d);
      dailyMap.set(dt.toISOString().slice(0, 10), { students: 0, committee_members: 0 });
    }
    for (const log of logs) {
      const key = log.logged_in_at.slice(0, 10);
      const b = dailyMap.get(key);
      if (b) {
        if (log.role === 'student') b.students++;
        if (log.role === 'committee_member') b.committee_members++;
      }
    }

    const daily_series = Array.from(dailyMap.entries()).map(([date, counts]) => ({
      date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      }),
      students: counts.students,
      committee_members: counts.committee_members,
      total: counts.students + counts.committee_members,
    }));

    const weekly_series = [3, 2, 1, 0].map((weekIdx) => {
      const endMs = now.getTime() - weekIdx * 7 * 86400 * 1000;
      const startMs = endMs - 7 * 86400 * 1000;
      let students = 0;
      let committee_members = 0;
      for (const log of logs) {
        const t = new Date(log.logged_in_at).getTime();
        if (t >= startMs && t < endMs) {
          if (log.role === 'student') students++;
          if (log.role === 'committee_member') committee_members++;
        }
      }
      return {
        week: weekIdx === 0 ? 'This Week' : `${weekIdx}w ago`,
        students,
        committee_members,
        total: students + committee_members,
      };
    });

    const committee_stats = committees.map((c) => ({
      committee_id: c.id,
      committee_name: c.name,
      members_count: profiles.filter(
        (p) => p.role === 'committee_member' && p.committee_id === c.id
      ).length,
      notices_count: notices.filter((n) => n.committee_id === c.id).length,
      events_count: events.filter((e) => e.committee_id === c.id).length,
      gallery_count: gallery.filter((g) => g.committee_id === c.id).length,
      documents_count: docs.filter((d) => d.committee_id === c.id).length,
    }));

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const recent_logs = logs.slice(0, 30).map((l) => {
      const u = profileMap.get(l.user_id);
      return {
        ...l,
        user_name: l.user_name || u?.name || 'College User',
        user_email: l.user_email ?? u?.email ?? null,
      };
    });

    return {
      total_students_logged_in,
      total_committee_members_logged_in,
      logins_today,
      logins_this_week,
      logins_this_month,
      daily_series,
      weekly_series,
      committee_stats,
      recent_logs,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('{')) throw error;
    handleFirestoreError(error, OperationType.LIST, 'loginLogs');
  }
}
