# Security Specification — J.M. Patel College Firebase Portal

## 1. Data Invariants
1. **Single Principal Admin & Trusted Admin Gate**: Admin status is verified exclusively against `/admins/{uid}` or a verified runtime admin email (`shaikhsalim63325@gmail.com` with `email_verified == true`), never via client claims.
2. **No Self-Role Escalation**: A self-registering user can ONLY create `/users/{uid}` with `role == 'student'` and `is_active == true` (except the one-time atomic Principal bootstrap). Users can NEVER modify `role`, `committee_id`, `username`, `is_active`, or `uid`.
3. **Committee Isolation**: A `committee_member` can create, update, and delete `notices`, `events`, `gallery`, and `documents` ONLY when `committee_id` matches their `/users/{uid}.committee_id` and `is_active == true`.
4. **Private Documents Isolation**: `documents` are readable ONLY by active `admin` or an active `committee_member` whose `committee_id` matches `resource.data.committee_id`. Students have zero access to `documents`.
5. **Login Audit Integrity**: Any active user may create a `loginLogs` record ONLY with `user_id == request.auth.uid`, `role == ownRole`, and `logged_in_at == request.time`. Only `admin` may read `loginLogs`.
6. **Disabled Account Lockout**: Users with `is_active == false` are denied all reads/writes on notices, events, gallery, documents, and loginLogs.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Self-Role Escalation on Create**: Student creates `/users/{uid}` with `{ role: 'admin', ... }` -> Denied.
2. **Self-Role Escalation on Update**: Committee member updates `/users/{uid}` changing `role` to `'admin'` or `committee_id` to another committee -> Denied.
3. **Shadow Ghost Field Injection**: User creates `/notices/{id}` with `{ ..., isVerified: true }` -> Denied by `keys().hasOnly(...)`.
4. **Unverified Admin Email Spoof**: User with `email_verified: false` tries admin-only read on `/loginLogs` -> Denied.
5. **Cross-Committee Write**: Committee `nss` member creates `/notices/{id}` with `committee_id: 'bscit'` -> Denied.
6. **Cross-Committee Private Document Read**: Committee `nss` member reads `/documents/{docId}` belonging to `'bscit'` -> Denied.
7. **Student Reading Private Documents**: Student queries `/documents` -> Denied.
8. **Student/Member Reading Login Logs**: Committee member queries `/loginLogs` -> Denied.
9. **Disabled User Write**: Disabled member (`is_active: false`) creates `/notices/{id}` -> Denied.
10. **Fake Timestamp Injection**: User creates `/loginLogs/{id}` with `logged_in_at` != `request.time` -> Denied.
11. **Oversized ID Poisoning**: Request writes `/notices/{1500_char_id}` -> Denied by `isValidId()`.
12. **PII Blanket Read**: Student lists `/users` collection -> Denied.
