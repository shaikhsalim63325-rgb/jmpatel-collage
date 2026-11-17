import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Building2,
  Calendar,
  FileText,
  FolderLock,
  Image as ImageIcon,
  LayoutGrid,
  LogIn,
  LogOut,
  Moon,
  Shield,
  Sun,
  Users,
} from 'lucide-react';
import { AdminDashboard, type AdminTab } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { CollegeLogo } from './components/CollegeLogo';
import { CommitteeDashboard, type CommitteeTab } from './components/CommitteeDashboard';
import { ForcePasswordChangeModal } from './components/ForcePasswordChangeModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { StudentPortalView, type StudentSection } from './components/StudentPortalView';
import { ToastContainer } from './components/ToastContainer';
import { getCommitteeName } from './data/committees';
import { testFirestoreConnection } from './lib/firebase';
import * as api from './services/api';
import type {
  AdminAnalytics,
  Committee,
  DocumentItem,
  EventItem,
  GalleryItem,
  Notice,
  Profile,
  ToastMessage,
} from './types/portal';

const THEME_KEY = 'jmp_theme_mode';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const [profile, setProfile] = useState<Profile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [bootLoading, setBootLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);

  const [committees, setCommittees] = useState<Committee[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticesError, setNoticesError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);

  // Role-based active views
  const [studentSection, setStudentSection] = useState<StudentSection>('home');
  const [committeeTab, setCommitteeTab] = useState<CommitteeTab>('notices');
  const [adminTab, setAdminTab] = useState<AdminTab>('analytics');

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (type: 'success' | 'error' | 'info', title: string, message?: string) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, title, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // Ignore
    }
  }, [darkMode]);

  const loadPortalData = useCallback(
    async (activeUser: Profile | null) => {
      setDataLoading(true);
      try {
        const fetchedCommittees = await api.fetchCommittees();
        setCommittees(fetchedCommittees);

        // If user must change password, defer loading sensitive workspace payloads until password is updated
        if (activeUser?.must_change_password) {
          setDataLoading(false);
          return;
        }

        const [nRes, eRes, gRes] = await Promise.allSettled([
          api.fetchNotices(),
          api.fetchEvents(),
          api.fetchGallery(),
        ]);

        if (nRes.status === 'fulfilled') {
          setNotices(nRes.value);
          setNoticesError(null);
        } else {
          console.error('Failed to load notices:', nRes.reason);
          const msg = api.extractReadableErrorMessage(nRes.reason);
          setNotices([]);
          setNoticesError(msg);
          addToast('error', 'Notices load nahi ho paaye', msg);
        }

        if (eRes.status === 'fulfilled') {
          setEvents(eRes.value);
        } else {
          console.error('Failed to load events:', eRes.reason);
        }

        if (gRes.status === 'fulfilled') {
          setGallery(gRes.value);
        } else {
          console.error('Failed to load gallery:', gRes.reason);
        }

        if (activeUser && (activeUser.role === 'admin' || activeUser.role === 'committee_member')) {
          const docs = await api.fetchDocuments();
          setDocuments(docs);
        } else {
          setDocuments([]);
        }

        if (activeUser?.role === 'admin') {
          const [memberList, analyticsData] = await Promise.all([
            api.fetchCommitteeMembers(),
            api.fetchAdminAnalytics(fetchedCommittees),
          ]);
          setMembers(memberList);
          setAnalytics(analyticsData);
        } else {
          setMembers([]);
          setAnalytics(null);
        }
      } catch (err) {
        let msg = err instanceof Error ? err.message : undefined;
        if (msg && msg.startsWith('{')) {
          try {
            const parsed = JSON.parse(msg) as { error?: string };
            msg = parsed.error || msg;
          } catch {
            // keep original
          }
        }
        addToast('error', 'Unable to load portal data', msg);
      } finally {
        setDataLoading(false);
      }
    },
    [addToast]
  );

  // Initial session hydration & Firestore connection validation
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await testFirestoreConnection();
        const current = await api.getCurrentProfile();
        if (!cancelled) {
          setProfile(current);
          await loadPortalData(current);
        }
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPortalData]);

  const handleAuthenticated = async (loggedInProfile: Profile) => {
    setProfile(loggedInProfile);
    setAuthModalOpen(false);
    addToast('success', `Welcome, ${loggedInProfile.name}`);
    await loadPortalData(loggedInProfile);
  };

  const handleLogout = async () => {
    await api.logout();
    setProfile(null);
    setDocuments([]);
    setMembers([]);
    setAnalytics(null);
    setStudentSection('home');
    addToast('info', 'Signed out');
    await loadPortalData(null);
  };

  const handleRefresh = useCallback(async () => {
    await loadPortalData(profile);
  }, [loadPortalData, profile]);

  const activeCommittee = useMemo(
    () => committees.find((c) => c.id === profile?.committee_id),
    [committees, profile?.committee_id]
  );

  // Build role-specific navigation items (must remain above any early returns)
  const navItems = useMemo(() => {
    if (profile?.role === 'admin') {
      return [
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'committees', label: 'Committees', icon: Building2 },
        { id: 'members', label: 'Members', icon: Users },
        { id: 'content', label: 'Content', icon: FileText },
        { id: 'logs', label: 'Login Logs', icon: Shield },
      ] as const;
    }
    if (profile?.role === 'committee_member') {
      return [
        { id: 'notices', label: 'Notices', icon: FileText },
        { id: 'events', label: 'Events', icon: Calendar },
        { id: 'gallery', label: 'Gallery', icon: ImageIcon },
        { id: 'documents', label: 'Documents', icon: FolderLock },
      ] as const;
    }
    return [
      { id: 'home', label: 'Committees', icon: LayoutGrid },
      { id: 'notices', label: 'Notices', icon: Bell },
      { id: 'events', label: 'Events', icon: Calendar },
      { id: 'gallery', label: 'Gallery', icon: ImageIcon },
    ] as const;
  }, [profile?.role]);

  // Route Guard 1: Mandatory password change on first login / after Principal reset
  if (!bootLoading && profile?.must_change_password) {
    return (
      <>
        <ForcePasswordChangeModal
          profile={profile}
          onSuccess={async (updated) => {
            setProfile(updated);
            addToast('success', 'Password updated', 'Your workspace is now unlocked.');
            await loadPortalData(updated);
          }}
          onLogout={handleLogout}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <OfflineIndicator />
      </>
    );
  }

  const currentNavId =
    profile?.role === 'admin'
      ? adminTab
      : profile?.role === 'committee_member'
      ? committeeTab
      : studentSection;

  const handleSelectNav = (id: string) => {
    if (profile?.role === 'admin') {
      setAdminTab(id as AdminTab);
    } else if (profile?.role === 'committee_member') {
      setCommitteeTab(id as CommitteeTab);
    } else {
      setStudentSection(id as StudentSection);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30">
        <div className="h-16 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <CollegeLogo className="w-9 h-9 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              SKM&apos;S J.M. Patel College of Commerce
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {profile?.role === 'admin'
                ? 'Principal Administration'
                : profile?.role === 'committee_member'
                ? getCommitteeName(committees, profile.committee_id)
                : 'Campus & Committees'}
            </p>
          </div>
        </div>

        <nav aria-label="Primary sidebar" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentNavId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <PWAInstallButton compact />
          </div>

          {profile ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {profile.name}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                <span className="capitalize">{profile.role.replace('_', ' ')}</span>
                {profile.email ? ` · ${profile.email}` : ''}
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2.5 w-full min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthInitialMode('login');
                setAuthModalOpen(true);
              }}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Compact Top Bar (52px) */}
      <header className="md:hidden sticky top-0 z-30 h-[52px] px-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <CollegeLogo className="w-8 h-8 shrink-0" />
          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
            SKM&apos;S J.M. Patel College of Commerce
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {profile ? (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthInitialMode('login');
                setAuthModalOpen(true);
              }}
              className="min-h-[38px] px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="md:pl-64 pb-20 md:pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {bootLoading ? (
            <div className="space-y-4">
              <div className="h-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="h-32 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
                <div className="h-32 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
                <div className="h-32 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
              </div>
            </div>
          ) : profile?.role === 'admin' ? (
            <AdminDashboard
              profile={profile}
              activeTab={adminTab}
              onChangeTab={setAdminTab}
              committees={committees}
              notices={notices}
              events={events}
              gallery={gallery}
              documents={documents}
              members={members}
              analytics={analytics}
              onRefresh={handleRefresh}
              onToast={addToast}
            />
          ) : profile?.role === 'committee_member' ? (
            <CommitteeDashboard
              profile={profile}
              committee={activeCommittee}
              activeTab={committeeTab}
              onChangeTab={setCommitteeTab}
              notices={notices}
              events={events}
              gallery={gallery}
              documents={documents}
              onRefresh={handleRefresh}
              onToast={addToast}
            />
          ) : (
            <StudentPortalView
              activeSection={studentSection}
              onChangeSection={setStudentSection}
              committees={committees}
              notices={notices}
              noticesError={noticesError}
              events={events}
              gallery={gallery}
              loading={dataLoading}
            />
          )}
        </div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (60px + safe area) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe"
      >
        <div className={`grid h-[60px] ${navItems.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentNavId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors cursor-pointer ${
                  active
                    ? 'text-blue-700 dark:text-blue-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[11px] leading-none truncate max-w-[72px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {authModalOpen && (
        <AuthModal
          initialMode={authInitialMode}
          onClose={() => setAuthModalOpen(false)}
          onAuthenticated={handleAuthenticated}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <OfflineIndicator />
    </div>
  );
}
