export type UserRole = 'admin' | 'committee_member' | 'student';

export interface Committee {
  id: string;
  name: string;
  description: string;
  logo_url?: string | null;
  department_group?: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  committee_id: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export interface Notice {
  id: string;
  committee_id: string;
  title: string;
  description: string;
  file_url: string | null;
  file_name?: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface EventItem {
  id: string;
  committee_id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  created_by: string | null;
  created_at?: string;
}

export interface GalleryItem {
  id: string;
  committee_id: string;
  image_url: string;
  caption: string;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  committee_id: string;
  title: string;
  file_url: string;
  file_name?: string | null;
  created_at: string;
}

export interface LoginLog {
  id: string;
  user_id: string;
  role: UserRole;
  committee_id: string | null;
  logged_in_at: string;
  user_name?: string;
  user_email?: string | null;
}

export interface DailyLoginBucket {
  date: string;
  label: string;
  students: number;
  committee_members: number;
  total: number;
}

export interface WeeklyLoginBucket {
  week: string;
  students: number;
  committee_members: number;
  total: number;
}

export interface CommitteeStats {
  committee_id: string;
  committee_name: string;
  members_count: number;
  notices_count: number;
  events_count: number;
  gallery_count: number;
  documents_count: number;
}

export interface AdminAnalytics {
  total_students_logged_in: number;
  total_committee_members_logged_in: number;
  logins_today: number;
  logins_this_week: number;
  logins_this_month: number;
  daily_series: DailyLoginBucket[];
  weekly_series: WeeklyLoginBucket[];
  committee_stats: CommitteeStats[];
  recent_logs: LoginLog[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}
