-- ============================================================================
-- J.M. PATEL COLLEGE — COMMITTEES PORTAL
-- Complete PostgreSQL Schema, RLS Policies, Triggers & Supabase Storage Setup
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.committees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'committee_member', 'student')),
  committee_id TEXT REFERENCES public.committees(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT username_lowercase_check CHECK (username IS NULL OR username = LOWER(username)),
  CONSTRAINT committee_member_requires_committee CHECK (
    (role = 'committee_member' AND committee_id IS NOT NULL) OR
    (role <> 'committee_member')
  )
);

-- Enforce only ONE admin (College Principal) account in the entire system
CREATE UNIQUE INDEX IF NOT EXISTS only_one_admin_idx
  ON public.profiles (role)
  WHERE role = 'admin';

CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id TEXT NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  file_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id TEXT NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id TEXT NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id TEXT NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'committee_member', 'student')),
  committee_id TEXT REFERENCES public.committees(id) ON DELETE SET NULL,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_notices_committee_created ON public.notices(committee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_committee_date ON public.events(committee_id, date ASC);
CREATE INDEX IF NOT EXISTS idx_gallery_committee_created ON public.gallery(committee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_committee_created ON public.documents(committee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_logged_in_at ON public.login_logs(logged_in_at DESC);

-- ----------------------------------------------------------------------------
-- 2. SECURITY HELPER FUNCTIONS (SECURITY DEFINER)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
$$;

CREATE OR REPLACE FUNCTION public.current_user_committee()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT committee_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
$$;

-- Prevent non-admin users from altering their own role, committee_id, username, or is_active
CREATE OR REPLACE FUNCTION public.protect_profile_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.committee_id IS DISTINCT FROM OLD.committee_id
       OR NEW.username IS DISTINCT FROM OLD.username
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Only the Principal (Admin) can modify role, committee, username, or active status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_immutable ON public.profiles;
CREATE TRIGGER trg_protect_profile_immutable
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_immutable_fields();

-- Auto-create student profile when a student self-registers via Supabase Auth
-- (Admin and Committee Members are created via the Edge Function using service_role)
CREATE OR REPLACE FUNCTION public.handle_new_student_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip auto-profile if already created or if internal @jmpatel.app staff account
  IF NEW.email LIKE '%@jmpatel.app' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, name, username, email, role, committee_id, is_active, must_change_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    NULL,
    NEW.email,
    'student',
    NULL,
    TRUE,
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_student_user();

-- ----------------------------------------------------------------------------
-- 3. ENABLE ROW LEVEL SECURITY (RLS) ON EVERY TABLE
-- ----------------------------------------------------------------------------

ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. RLS POLICIES
-- ----------------------------------------------------------------------------

-- COMMITTEES:
-- Active users (or public students browsing before login) can view committee directory;
-- Only active admin can insert/update/delete committees.
CREATE POLICY "committees_read_active_or_public"
  ON public.committees FOR SELECT
  USING (
    auth.uid() IS NULL
    OR public.is_active_user()
  );

CREATE POLICY "committees_admin_manage"
  ON public.committees FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- PROFILES:
-- Users can read their own profile (needed during login check to inspect is_active & must_change_password).
-- Admin can read and manage all profiles.
-- Committee members and students CANNOT read other users' profiles.
CREATE POLICY "profiles_read_own_or_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "profiles_update_own_password_flag"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND public.is_active_user())
  WITH CHECK (id = auth.uid() AND public.is_active_user());

CREATE POLICY "profiles_admin_manage"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- NOTICES:
-- Admin: full access to all committees.
-- Committee Member (active): full access ONLY to their own committee_id.
-- Student (active): read-only access to published notices.
-- Disabled users (is_active = false): zero access.
CREATE POLICY "notices_read_by_role"
  ON public.notices FOR SELECT
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.current_user_role() IN ('admin', 'student')
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

CREATE POLICY "notices_insert_committee_or_admin"
  ON public.notices FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

CREATE POLICY "notices_update_committee_or_admin"
  ON public.notices FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  )
  WITH CHECK (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

CREATE POLICY "notices_delete_committee_or_admin"
  ON public.notices FOR DELETE
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

-- EVENTS:
CREATE POLICY "events_read_by_role"
  ON public.events FOR SELECT
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.current_user_role() IN ('admin', 'student')
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

CREATE POLICY "events_insert_committee_or_admin"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

CREATE POLICY "events_update_committee_or_admin"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  )
  WITH CHECK (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

CREATE POLICY "events_delete_committee_or_admin"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

-- GALLERY:
CREATE POLICY "gallery_read_by_role"
  ON public.gallery FOR SELECT
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.current_user_role() IN ('admin', 'student')
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

CREATE POLICY "gallery_insert_committee_or_admin"
  ON public.gallery FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

CREATE POLICY "gallery_update_committee_or_admin"
  ON public.gallery FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  )
  WITH CHECK (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

CREATE POLICY "gallery_delete_committee_or_admin"
  ON public.gallery FOR DELETE
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

-- DOCUMENTS (Internal / Committee Documents — Students cannot see private committee documents):
CREATE POLICY "documents_read_committee_or_admin"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

CREATE POLICY "documents_insert_committee_or_admin"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

CREATE POLICY "documents_update_committee_or_admin"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  )
  WITH CHECK (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

CREATE POLICY "documents_delete_committee_or_admin"
  ON public.documents FOR DELETE
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'committee_member' AND committee_id = public.current_user_committee())
    )
  );

-- LOGIN_LOGS:
-- Any active authenticated user can insert ONLY their own login log row.
-- ONLY Admin can SELECT login_logs. Committee members and students CANNOT read login_logs.
CREATE POLICY "login_logs_insert_own"
  ON public.login_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND user_id = auth.uid()
    AND role = public.current_user_role()
    AND (committee_id IS NOT DISTINCT FROM public.current_user_committee())
  );

CREATE POLICY "login_logs_admin_select_only"
  ON public.login_logs FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- 5. SUPABASE STORAGE BUCKET & FOLDER-ISOLATED POLICIES
-- ----------------------------------------------------------------------------
-- Folder structure inside bucket 'committee-files':
--   <committee_id>/notices/<filename>
--   <committee_id>/gallery/<filename>
--   <committee_id>/documents/<filename>

INSERT INTO storage.buckets (id, name, public)
VALUES ('committee-files', 'committee-files', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Read files:
-- Admin can read all folders.
-- Committee members can read ONLY their own committee folder (and published notice/gallery assets).
-- Students can read ONLY notices/ and gallery/ subfolders (never documents/).
-- Disabled users cannot read anything.
CREATE POLICY "storage_read_committee_files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'committee-files'
    AND public.is_active_user()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'committee_member'
        AND (storage.foldername(name))[1] = public.current_user_committee()
      )
      OR (
        public.current_user_role() = 'student'
        AND (storage.foldername(name))[2] IN ('notices', 'gallery')
      )
    )
  );

-- Upload files: Only active Admin or Committee Member inside their own <committee_id> folder
CREATE POLICY "storage_insert_committee_files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'committee-files'
    AND public.is_active_user()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'committee_member'
        AND (storage.foldername(name))[1] = public.current_user_committee()
      )
    )
  );

-- Update/Delete files: Only active Admin or Committee Member inside their own <committee_id> folder
CREATE POLICY "storage_delete_committee_files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'committee-files'
    AND public.is_active_user()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'committee_member'
        AND (storage.foldername(name))[1] = public.current_user_committee()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 6. SEED ALL 17 J.M. PATEL COLLEGE COMMITTEES
-- ----------------------------------------------------------------------------

INSERT INTO public.committees (id, name, description) VALUES
  ('wdc', 'WDC', 'Women Development Cell — Empowering female students and staff through awareness workshops, safety initiatives, and gender sensitization programs.'),
  ('library', 'Library', 'Central Knowledge Resource Centre — Managing academic journals, digital repositories, book exhibitions, and reading room initiatives.'),
  ('marathi-wangmay-mandal', 'Marathi Wangmay Mandal', 'Celebrating Marathi literature, poetry recitals, elocution competitions, and cultural heritage across the campus.'),
  ('hindi-bhasha', 'Hindi Bhasha', 'Promoting Hindi language proficiency, creative writing, Kavi Sammelan, and Hindi Diwas literary events.'),
  ('gujarati-sahitya-mandal', 'Gujarati Sahitya Mandal', 'Fostering appreciation for Gujarati prose, poetry, folk arts, and inter-collegiate literary festivals.'),
  ('cultural-committee', 'Cultural Committee', 'Organizing annual college festivals, performing arts showcases, music, dance, drama, and inter-college cultural representation.'),
  ('nss', 'NSS', 'National Service Scheme — Driving community outreach, blood donation camps, rural adoption drives, and civic social responsibility.'),
  ('green-club', 'Green Club', 'Environmental conservation collective leading campus plantation drives, e-waste recycling, and sustainability audits.'),
  ('students-council', 'Student''s Council', 'Elected student governance body bridging student welfare, campus coordination, and academic leadership.'),
  ('sports', 'Sports', 'Department of Physical Education & Sports — Coordinating inter-collegiate tournaments, annual athletic meets, and indoor/outdoor sports coaching.'),
  ('research-cell', 'Research Cell', 'Encouraging undergraduate and postgraduate research publications, Avishkar convention mentorship, and faculty research grants.'),
  ('edc', 'EDC', 'Entrepreneurship Development Cell — Mentoring student startups, business plan competitions, industry talks, and innovation bootcamps.'),
  ('commerce-department', 'Commerce Department', 'Organizing accountancy seminars, taxation clinics, corporate guest lectures, and commerce career workshops.'),
  ('economic-department', 'Economic Department', 'Hosting budget analysis forums, policy debates, economic surveys, and financial literacy conclaves.'),
  ('bms', 'BMS', 'Bachelor of Management Studies — Leading case-study challenges, corporate leadership summits, and management fests.'),
  ('baf', 'BAF', 'Bachelor of Accounting & Finance — Conducting fintech workshops, equity market simulations, and audit practitioner sessions.'),
  ('bscit', 'BSCIT', 'B.Sc. Information Technology — Running hackathons, coding bootcamps, cybersecurity seminars, and software project exhibitions.')
ON CONFLICT (id) DO NOTHING;
