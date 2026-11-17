# J.M. Patel College — Supabase Setup & Principal Onboarding Guide

This portal uses **Supabase Auth**, **PostgreSQL with Row Level Security (RLS)**, **Supabase Storage**, and a **Supabase Edge Function** (`manage-member`) so that the `service_role` key is never exposed in the frontend.

---

## 1. Create Supabase Project & Configure Environment Variables

1. Create a new project at [supabase.com](https://supabase.com).
2. Copy your **Project URL** and **Anon (public) key** from **Project Settings → API**.
3. Create a `.env` file in the root of this repository based on `.env.example`:

```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
```

---

## 2. Run the SQL Schema, RLS Policies, Storage Bucket & Committee Seeds

1. Open the **SQL Editor** in your Supabase Dashboard.
2. Paste the entire contents of `supabase/schema.sql` and click **Run**.
3. This creates:
   - All 7 tables (`committees`, `profiles`, `notices`, `events`, `gallery`, `documents`, `login_logs`)
   - Strict RLS policies on every table (Committee 1 cannot read/write Committee 2 data; disabled users have zero access; only Admin can read `login_logs`; users cannot change their own `role` or `committee_id`)
   - Private Storage bucket `committee-files` with `<committee_id>/...` folder policies
   - All **17 J.M. Patel College committees** pre-seeded

---

## 3. Create the First Admin (College Principal) Account

Admin and Committee Members log in using **Username + Password** (internally mapped to `<username>@jmpatel.app`, which is never shown in the UI). Because there can be only **one** `admin` account in the database (`only_one_admin_idx`), follow these steps to bootstrap the Principal account:

### Option A: Using Supabase Dashboard + SQL Editor (Recommended)

1. Go to **Authentication → Users → Add user → Create new user**.
2. Enter:
   - **Email**: `principal@jmpatel.app` *(replace `principal` with your desired lowercase username, e.g. `dr_patel@jmpatel.app`)*
   - **Password**: Choose a strong initial password
   - Check **Auto Confirm User** and click **Create user**.
3. Copy the newly created user's **UUID** (`id` column in Authentication → Users).
4. Run the following SQL in the **SQL Editor** (replacing `<USER_UUID>`, `Dr. J.M. Patel (Principal)`, and `principal` with your username):

```sql
INSERT INTO public.profiles (
  id,
  name,
  username,
  email,
  role,
  committee_id,
  is_active,
  must_change_password
)
VALUES (
  '<USER_UUID>',
  'College Principal',
  'principal',
  NULL,
  'admin',
  NULL,
  TRUE,
  FALSE
);
```

> **Note on `must_change_password`:** Set `must_change_password` to `TRUE` if you want the Principal to be forced to set a new personal password on their very first login.

### Option B: Using Supabase Auth Admin API (cURL)

```bash
# 1. Create Auth user
curl -X POST "https://<YOUR-PROJECT>.supabase.co/auth/v1/admin/users" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "principal@jmpatel.app",
    "password": "StrongInitialPassword!2026",
    "email_confirm": true
  }'
```

Then run the `INSERT INTO public.profiles ... role = 'admin'` SQL statement above with the returned `id`.

---

## 4. Deploy the `manage-member` Edge Function

Committee Member accounts are created, disabled/enabled, password-reset, and deleted **only** by the Principal through the `manage-member` Edge Function (`supabase/functions/manage-member/index.ts`).

1. Install and link the Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
```

2. Deploy the function:
```bash
supabase functions deploy manage-member
```

Supabase automatically injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into the Edge Function runtime.

---

## 5. Authentication & Security Checklist

- **Principal / Committee Login**: Enter `username` (e.g. `principal` or `nss_priya`) + password. The frontend internally maps it to `<username>@jmpatel.app` without exposing it.
- **First-Login Password Reset**: Any account created or reset by the Principal has `must_change_password = true` and is automatically routed to the mandatory password change screen upon login.
- **Student Registration**: Students can self-register using their personal email + password (`Authentication → Providers → Email`). Note: Disable "Confirm email" in Supabase Auth settings if you want instant student sign-in without email verification during campus onboarding.
