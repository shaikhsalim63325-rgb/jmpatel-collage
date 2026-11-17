import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileText,
  ImagePlus,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { getCommitteeName } from '../data/committees';
import * as api from '../services/api';
import type {
  AdminAnalytics,
  Committee,
  DocumentItem,
  EventItem,
  GalleryItem,
  Notice,
  Profile,
} from '../types/portal';
import { ResilientImage } from './ResilientImage';

export type AdminTab = 'analytics' | 'committees' | 'members' | 'content' | 'logs';

interface AdminDashboardProps {
  profile: Profile;
  activeTab: AdminTab;
  onChangeTab: (tab: AdminTab) => void;
  committees: Committee[];
  notices: Notice[];
  events: EventItem[];
  gallery: GalleryItem[];
  documents: DocumentItem[];
  members: Profile[];
  analytics: AdminAnalytics | null;
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'abhi';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'abhi';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  profile,
  activeTab,
  onChangeTab,
  committees,
  notices,
  events,
  gallery,
  documents,
  members,
  analytics,
  onRefresh,
  onToast,
}) => {
  // Chart mode toggle (Daily / Weekly)
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly'>('daily');
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);

  // Committee CRUD modal & filters
  const [committeeModalOpen, setCommitteeModalOpen] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);
  const [committeeName, setCommitteeName] = useState('');
  const [committeeDept, setCommitteeDept] = useState('');
  const [committeeDesc, setCommitteeDesc] = useState('');
  const [committeeLogo, setCommitteeLogo] = useState<string | null>(null);
  const [encodingLogo, setEncodingLogo] = useState(false);
  const [committeeSearch, setCommitteeSearch] = useState('');
  const [deleteCommitteeTarget, setDeleteCommitteeTarget] = useState<Committee | null>(null);

  // Member creation modal
  const [createMemberOpen, setCreateMemberOpen] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberCommittee, setMemberCommittee] = useState(committees[0]?.id || '');
  const [memberSearch, setMemberSearch] = useState('');

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);

  // All-committees content management
  const [contentType, setContentType] = useState<'notices' | 'events' | 'gallery' | 'documents'>('notices');
  const [contentCommitteeFilter, setContentCommitteeFilter] = useState('all');
  const [contentSearch, setContentSearch] = useState('');

  // Edit notice modal (Admin can edit/delete any notice)
  const [editNoticeModal, setEditNoticeModal] = useState<Notice | null>(null);
  const [createNoticeOpen, setCreateNoticeOpen] = useState(false);
  const [noticeCommitteeId, setNoticeCommitteeId] = useState(committees[0]?.id || '');
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeDesc, setNoticeDesc] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (committees.length === 0) {
      setMemberCommittee('');
      setNoticeCommitteeId('');
      return;
    }
    if (!committees.some((c) => c.id === memberCommittee)) {
      setMemberCommittee(committees[0].id);
    }
    if (!committees.some((c) => c.id === noticeCommitteeId)) {
      setNoticeCommitteeId(committees[0].id);
    }
  }, [committees, memberCommittee, noticeCommitteeId]);

  const filteredCommittees = useMemo(() => {
    const q = committeeSearch.trim().toLowerCase();
    if (!q) return committees;
    return committees.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.department_group || '').toLowerCase().includes(q)
    );
  }, [committees, committeeSearch]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return members.filter((m) => {
      if (!q) return true;
      const cName = getCommitteeName(committees, m.committee_id).toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        cName.includes(q)
      );
    });
  }, [members, memberSearch, committees]);

  const filteredNotices = useMemo(() => {
    const q = contentSearch.trim().toLowerCase();
    return notices.filter((n) => {
      if (contentCommitteeFilter !== 'all' && n.committee_id !== contentCommitteeFilter) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        getCommitteeName(committees, n.committee_id).toLowerCase().includes(q)
      );
    });
  }, [notices, contentCommitteeFilter, contentSearch, committees]);

  const filteredEvents = useMemo(() => {
    const q = contentSearch.trim().toLowerCase();
    return events.filter((e) => {
      if (contentCommitteeFilter !== 'all' && e.committee_id !== contentCommitteeFilter) return false;
      if (!q) return true;
      return e.title.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q);
    });
  }, [events, contentCommitteeFilter, contentSearch]);

  const filteredGallery = useMemo(() => {
    return gallery.filter(
      (g) => contentCommitteeFilter === 'all' || g.committee_id === contentCommitteeFilter
    );
  }, [gallery, contentCommitteeFilter]);

  const filteredDocuments = useMemo(() => {
    const q = contentSearch.trim().toLowerCase();
    return documents.filter((d) => {
      if (contentCommitteeFilter !== 'all' && d.committee_id !== contentCommitteeFilter) return false;
      if (!q) return true;
      return d.title.toLowerCase().includes(q);
    });
  }, [documents, contentCommitteeFilter, contentSearch]);

  const openAddCommitteeModal = () => {
    setEditingCommittee(null);
    setCommitteeName('');
    setCommitteeDept('');
    setCommitteeDesc('');
    setCommitteeLogo(null);
    setCommitteeModalOpen(true);
  };

  const openEditCommitteeModal = (committee: Committee) => {
    setEditingCommittee(committee);
    setCommitteeName(committee.name);
    setCommitteeDept(committee.department_group || '');
    setCommitteeDesc(committee.description);
    setCommitteeLogo(committee.logo_url || null);
    setCommitteeModalOpen(true);
  };

  const handleCommitteeLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEncodingLogo(true);
    try {
      const encoded = await api.encodeCommitteeLogo(file);
      setCommitteeLogo(encoded);
    } catch (err) {
      onToast('error', 'Invalid logo file', err instanceof Error ? err.message : undefined);
    } finally {
      setEncodingLogo(false);
      e.target.value = '';
    }
  };

  const handleSaveCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingCommittee) {
        await api.updateCommittee(editingCommittee.id, {
          name: committeeName,
          description: committeeDesc,
          department_group: committeeDept || undefined,
          logo_url: committeeLogo,
        });
        onToast('success', 'Committee updated', `${committeeName.trim()} has been saved.`);
      } else {
        const created = await api.createCommittee({
          name: committeeName,
          description: committeeDesc,
          department_group: committeeDept || undefined,
          logo_url: committeeLogo,
        });
        setMemberCommittee(created.id);
        setNoticeCommitteeId(created.id);
        onToast('success', 'Committee added', `${created.name} is now live in the portal.`);
      }
      setCommitteeModalOpen(false);
      setEditingCommittee(null);
      await onRefresh();
    } catch (err) {
      onToast('error', 'Could not save committee', err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDeleteCommittee = async () => {
    if (!deleteCommitteeTarget) return;
    setSubmitting(true);
    try {
      await api.deleteCommittee(deleteCommitteeTarget.id);
      onToast('success', 'Committee deleted', `${deleteCommitteeTarget.name} has been removed.`);
      if (contentCommitteeFilter === deleteCommitteeTarget.id) {
        setContentCommitteeFilter('all');
      }
      setDeleteCommitteeTarget(null);
      await onRefresh();
    } catch (err) {
      onToast('error', 'Could not delete committee', err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateMemberModal = () => {
    if (committees.length > 0 && !committees.some((c) => c.id === memberCommittee)) {
      setMemberCommittee(committees[0].id);
    }
    setCreateMemberOpen(true);
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberCommittee) {
      onToast('error', 'Select a committee', 'Create or select a committee first.');
      return;
    }
    setSubmitting(true);
    try {
      const cleanEmail = memberEmail.trim().toLowerCase();
      await api.createCommitteeMember({
        name: memberName,
        email: cleanEmail,
        password: memberPassword,
        committee_id: memberCommittee,
      });
      onToast(
        'success',
        'Committee member added',
        `"${cleanEmail}" will be prompted to change password on first login.`
      );
      setCreateMemberOpen(false);
      setMemberName('');
      setMemberEmail('');
      setMemberPassword('');
      await onRefresh();
    } catch (err) {
      onToast('error', 'Could not create member', err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (m: Profile) => {
    try {
      await api.toggleMemberActive(m.id, !m.is_active);
      onToast(
        'success',
        m.is_active ? 'Account disabled' : 'Account enabled',
        `${m.name}${m.email ? ` (${m.email})` : ''} access updated.`
      );
      await onRefresh();
    } catch (err) {
      onToast('error', 'Action failed', err instanceof Error ? err.message : undefined);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setSubmitting(true);
    try {
      await api.resetMemberPassword(resetTarget.id);
      onToast(
        'success',
        'Password change required',
        `${resetTarget.email || resetTarget.name} will be prompted to set a new password on next sign in.`
      );
      setResetTarget(null);
      await onRefresh();
    } catch (err) {
      onToast('error', 'Reset failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMemberResetEmail = async () => {
    if (!resetTarget?.email) return;
    setSubmitting(true);
    try {
      await api.sendResetPasswordEmail(resetTarget.email);
      onToast(
        'success',
        'Reset link sent',
        `Password reset email sent to ${resetTarget.email}.`
      );
      setResetTarget(null);
    } catch (err) {
      onToast('error', 'Could not send reset email', err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMember = async (m: Profile) => {
    try {
      await api.deleteCommitteeMember(m.id);
      onToast('success', 'Member removed', `${m.name} has been deleted.`);
      await onRefresh();
    } catch (err) {
      onToast('error', 'Remove failed', err instanceof Error ? err.message : undefined);
    }
  };

  const handleSaveAdminNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editNoticeModal) {
        await api.updateNotice(editNoticeModal.id, {
          title: noticeTitle,
          description: noticeDesc,
        });
        onToast('success', 'Notice updated');
        setEditNoticeModal(null);
      } else {
        await api.createNotice({
          committee_id: noticeCommitteeId,
          title: noticeTitle,
          description: noticeDesc,
        });
        onToast('success', 'Notice published');
        setCreateNoticeOpen(false);
      }
      await onRefresh();
    } catch (err) {
      onToast('error', 'Save failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      await api.deleteNotice(id);
      onToast('success', 'Notice deleted');
      await onRefresh();
    } catch (err) {
      onToast('error', 'Delete failed', err instanceof Error ? err.message : undefined);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await api.deleteEvent(id);
      onToast('success', 'Event deleted');
      await onRefresh();
    } catch (err) {
      onToast('error', 'Delete failed', err instanceof Error ? err.message : undefined);
    }
  };

  const handleDeleteGallery = async (id: string) => {
    try {
      await api.deleteGalleryItem(id);
      onToast('success', 'Photo deleted');
      await onRefresh();
    } catch (err) {
      onToast('error', 'Delete failed', err instanceof Error ? err.message : undefined);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await api.deleteDocument(id);
      onToast('success', 'Document deleted');
      await onRefresh();
    } catch (err) {
      onToast('error', 'Delete failed', err instanceof Error ? err.message : undefined);
    }
  };

  // Chart series calculation
  const chartBars = useMemo(() => {
    if (!analytics) return [];
    if (chartPeriod === 'daily') {
      return analytics.daily_series.map((d) => ({
        label: d.label,
        students: d.students,
        members: d.committee_members,
        total: d.total,
      }));
    }
    return analytics.weekly_series.map((w) => ({
      label: w.week,
      students: w.students,
      members: w.committee_members,
      total: w.total,
    }));
  }, [analytics, chartPeriod]);

  const maxChartVal = useMemo(
    () => Math.max(4, ...chartBars.map((b) => b.total)),
    [chartBars]
  );

  return (
    <div className="space-y-6">
      {/* Principal Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
            Principal Control Center · SKM&apos;S J.M. Patel College of Commerce
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            College Administration &amp; Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Signed in as {profile.name} · Full oversight across college committees and member accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openAddCommitteeModal}
            className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 text-xs font-semibold text-slate-800 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Committee</span>
          </button>
          <button
            type="button"
            onClick={openCreateMemberModal}
            className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Committee Member</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 overflow-x-auto">
        {(
          [
            { id: 'analytics', label: 'Analytics & Stats' },
            { id: 'committees', label: 'Manage Committees' },
            { id: 'members', label: 'Committee Members' },
            { id: 'content', label: 'All Committees Content' },
            { id: 'logs', label: 'Login Audit Logs' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: ANALYTICS & PER-COMMITTEE STATS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* 5 KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Students Logged In
              </p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {analytics?.total_students_logged_in ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Members Logged In
              </p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {analytics?.total_committee_members_logged_in ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Logins Today</p>
              <p className="mt-1.5 text-2xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                {analytics?.logins_today ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Logins This Week
              </p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {analytics?.logins_this_week ?? 0}
              </p>
            </div>
            <div className="col-span-2 md:col-span-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Logins This Month
              </p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {analytics?.logins_this_month ?? 0}
              </p>
            </div>
          </div>

          {/* Interactive Login Analytics Chart */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Login Activity Trend
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Principal-only breakdown of student and committee member sessions
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-700 inline-block" />
                    Students
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" />
                    Committee
                  </span>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setChartPeriod('daily');
                      setHoveredBarIdx(null);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      chartPeriod === 'daily'
                        ? 'bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChartPeriod('weekly');
                      setHoveredBarIdx(null);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      chartPeriod === 'weekly'
                        ? 'bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Weekly
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6">
              {hoveredBarIdx !== null && chartBars[hoveredBarIdx] && (
                <div className="mb-3 text-xs font-medium text-slate-700 dark:text-slate-200 tabular-nums">
                  {chartBars[hoveredBarIdx].label}: {chartBars[hoveredBarIdx].students} Students ·{' '}
                  {chartBars[hoveredBarIdx].members} Committee Members ({chartBars[hoveredBarIdx].total}{' '}
                  total)
                </div>
              )}
              <div className="h-52 flex items-end gap-2 sm:gap-3 pt-4 border-b border-slate-200 dark:border-slate-800">
                {chartBars.map((bar, idx) => {
                  const studentPct = Math.round((bar.students / maxChartVal) * 100);
                  const memberPct = Math.round((bar.members / maxChartVal) * 100);
                  return (
                    <div
                      key={bar.label}
                      onMouseEnter={() => setHoveredBarIdx(idx)}
                      onMouseLeave={() => setHoveredBarIdx(null)}
                      className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                    >
                      <div className="w-full max-w-[34px] flex flex-col justify-end h-full gap-0.5">
                        <div
                          style={{ height: `${Math.max(bar.members > 0 ? 4 : 0, memberPct)}%` }}
                          className="w-full rounded-t bg-sky-400 group-hover:bg-sky-300 transition-all"
                          title={`${bar.label}: ${bar.members} committee logins`}
                        />
                        <div
                          style={{ height: `${Math.max(bar.students > 0 ? 4 : 0, studentPct)}%` }}
                          className="w-full rounded-b-sm bg-blue-700 group-hover:bg-blue-600 transition-all"
                          title={`${bar.label}: ${bar.students} student logins`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2 sm:gap-3">
                {chartBars.map((bar, idx) => (
                  <div
                    key={bar.label}
                    className={`flex-1 text-center text-[10px] sm:text-[11px] font-mono truncate ${
                      chartPeriod === 'daily' && idx % 2 === 1 ? 'hidden sm:block' : ''
                    } text-slate-500 dark:text-slate-400`}
                  >
                    {bar.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Per-Committee Stats Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Per-Committee Activity Summary
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Members, notices, events, and resources across SKM&apos;S J.M. Patel College of Commerce committees
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-3 px-5">Committee</th>
                    <th className="py-3 px-4 text-right">Members</th>
                    <th className="py-3 px-4 text-right">Notices</th>
                    <th className="py-3 px-4 text-right">Events</th>
                    <th className="py-3 px-4 text-right">Gallery</th>
                    <th className="py-3 px-5 text-right">Documents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                  {(analytics?.committee_stats || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                        No committees created yet. Add your first committee from Manage Committees.
                      </td>
                    </tr>
                  ) : (
                    (analytics?.committee_stats || []).map((row) => (
                      <tr
                        key={row.committee_id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-5 font-medium text-slate-900 dark:text-white">
                          {row.committee_name}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                          {row.members_count}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                          {row.notices_count}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                          {row.events_count}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                          {row.gallery_count}
                        </td>
                        <td className="py-3 px-5 text-right text-slate-600 dark:text-slate-300">
                          {row.documents_count}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: MANAGE COMMITTEES (ADD / EDIT / DELETE) */}
      {activeTab === 'committees' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={committeeSearch}
                onChange={(e) => setCommitteeSearch(e.target.value)}
                placeholder="Search committees..."
                className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              type="button"
              onClick={openAddCommitteeModal}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Committee</span>
            </button>
          </div>

          {committees.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
              <Building2 className="w-9 h-9 mx-auto text-slate-400" />
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                Abhi koi committee nahi hai
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Add committees here so students can browse them and members can be assigned.
              </p>
              <button
                type="button"
                onClick={openAddCommitteeModal}
                className="mt-4 min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 text-xs font-semibold text-white cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Committee</span>
              </button>
            </div>
          ) : filteredCommittees.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
              No committees match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCommittees.map((c) => {
                const cMembers = members.filter((m) => m.committee_id === c.id).length;
                const cNotices = notices.filter((n) => n.committee_id === c.id).length;
                const cEvents = events.filter((ev) => ev.committee_id === c.id).length;
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start gap-3.5">
                        {c.logo_url ? (
                          <ResilientImage
                            src={c.logo_url}
                            alt={`${c.name} logo`}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-50 dark:bg-slate-800"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm shrink-0">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          {c.department_group && (
                            <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 truncate">
                              {c.department_group}
                            </p>
                          )}
                          <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                            {c.name}
                          </h3>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                        {c.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {cMembers} members · {cNotices} notices · {cEvents} events
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditCommitteeModal(c)}
                          aria-label={`Edit ${c.name}`}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteCommitteeTarget(c)}
                          aria-label={`Delete ${c.name}`}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMMITTEE MEMBER MANAGEMENT */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search by name, email, or committee..."
                className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              type="button"
              onClick={openCreateMemberModal}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Committee Member</span>
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-3 px-5">Member</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Committee</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                        No committee members found.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => (
                      <tr
                        key={m.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-5">
                          <p className="font-semibold text-slate-900 dark:text-white">{m.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            Added {formatDate(m.created_at)}
                            {m.must_change_password ? ' · Password reset pending' : ''}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-slate-300">
                          {m.email || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-200">
                          {getCommitteeName(committees, m.committee_id)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                              m.is_active
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {m.is_active ? (
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : (
                              <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            <span>{m.is_active ? 'Active' : 'Disabled'}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(m)}
                              className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                            >
                              {m.is_active ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResetTarget(m);
                              }}
                              aria-label={`Reset password for ${m.name}`}
                              className="min-h-[36px] px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Reset Password</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(m)}
                              aria-label={`Remove ${m.name}`}
                              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ALL COMMITTEES CONTENT */}
      {activeTab === 'content' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 self-start">
              {(['notices', 'events', 'gallery', 'documents'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setContentType(t)}
                  className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap cursor-pointer ${
                    contentType === t
                      ? 'bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={contentSearch}
                  onChange={(e) => setContentSearch(e.target.value)}
                  placeholder="Search content..."
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <select
                value={contentCommitteeFilter}
                onChange={(e) => setContentCommitteeFilter(e.target.value)}
                aria-label="Filter content by committee"
                className="min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Committees</option>
                {committees.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {contentType === 'notices' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditNoticeModal(null);
                    setNoticeTitle('');
                    setNoticeDesc('');
                    setNoticeCommitteeId(
                      contentCommitteeFilter !== 'all'
                        ? contentCommitteeFilter
                        : committees[0]?.id || ''
                    );
                    setCreateNoticeOpen(true);
                  }}
                  className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Post Notice</span>
                </button>
              )}
            </div>
          </div>

          {contentType === 'notices' && (
            <div className="space-y-3">
              {filteredNotices.map((n) => (
                <div
                  key={n.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span className="font-semibold text-blue-700 dark:text-blue-400">
                        {getCommitteeName(committees, n.committee_id)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(n.created_at)}</span>
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                      {n.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {n.description}
                    </p>
                    {n.file_url && (
                      <a
                        href={n.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{n.file_name || 'Attachment'}</span>
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditNoticeModal(n);
                        setNoticeTitle(n.title);
                        setNoticeDesc(n.description);
                      }}
                      aria-label="Edit notice"
                      className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNotice(n.id)}
                      aria-label="Delete notice"
                      className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredNotices.length === 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
                  <FileText className="w-7 h-7 mx-auto mb-2 opacity-50" />
                  No notices match your filter.
                </div>
              )}
            </div>
          )}

          {contentType === 'events' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 tabular-nums">
                      {getCommitteeName(committees, ev.committee_id)} · {formatDate(ev.date)}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                      {ev.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{ev.description}</p>
                    {ev.venue && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Venue: {ev.venue}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(ev.id)}
                    aria-label="Delete event"
                    className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {filteredEvents.length === 0 && (
                <div className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
                  <Calendar className="w-7 h-7 mx-auto mb-2 opacity-50" />
                  No events match your filter.
                </div>
              )}
            </div>
          )}

          {contentType === 'gallery' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGallery.map((g) => (
                <div
                  key={g.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                >
                  <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800">
                    <ResilientImage
                      src={g.image_url}
                      alt={g.caption}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                        {getCommitteeName(committees, g.committee_id)}
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white line-clamp-2">
                        {g.caption}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteGallery(g.id)}
                      aria-label="Delete gallery item"
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {contentType === 'documents' && (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                      {getCommitteeName(committees, doc.committee_id)}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {doc.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {doc.file_name || 'Document'} · {formatDate(doc.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-blue-700 dark:text-blue-400"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc.id)}
                      aria-label="Delete document"
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredDocuments.length === 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
                  No documents found for the selected filter.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LOGIN AUDIT LOGS (Principal Only) */}
      {activeTab === 'logs' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Authentication Audit Logs
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Restricted strictly to the College Principal via Firebase Security Rules
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-3 px-5">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Committee</th>
                  <th className="py-3 px-5 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {(analytics?.recent_logs || []).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-5">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {log.user_name || 'User'}
                      </span>
                      {log.user_email && (
                        <span className="ml-2 text-xs text-slate-500">
                          ({log.user_email})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs capitalize text-slate-600 dark:text-slate-300">
                      {log.role.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                      {log.committee_id ? getCommitteeName(committees, log.committee_id) : '—'}
                    </td>
                    <td className="py-3 px-5 text-right text-xs font-mono text-slate-500 dark:text-slate-400">
                      {formatDateTime(log.logged_in_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD / EDIT COMMITTEE MODAL */}
      {committeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingCommittee ? 'Edit Committee' : 'Add New Committee'}
              </h2>
              <button
                type="button"
                onClick={() => setCommitteeModalOpen(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Saved directly in Firestore so students can explore it and members can be assigned.
            </p>
            <form onSubmit={handleSaveCommittee} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Committee Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={committeeName}
                  onChange={(e) => setCommitteeName(e.target.value)}
                  placeholder="e.g. NSS, Cultural Committee, BSCIT"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Category / Department (optional)
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={committeeDept}
                  onChange={(e) => setCommitteeDept(e.target.value)}
                  placeholder="e.g. Student Activities, Academic, Cultural"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  maxLength={600}
                  value={committeeDesc}
                  onChange={(e) => setCommitteeDesc(e.target.value)}
                  placeholder="Briefly describe the committee's activities and purpose..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  Committee Logo (optional)
                </label>
                <div className="flex items-center gap-4">
                  {committeeLogo ? (
                    <img
                      src={committeeLogo}
                      alt="Committee logo preview"
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-50 dark:bg-slate-800"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="min-h-[38px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                      {encodingLogo ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ImagePlus className="w-4 h-4" />
                      )}
                      <span>{committeeLogo ? 'Change Logo' : 'Upload Logo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCommitteeLogoChange}
                        className="sr-only"
                      />
                    </label>
                    {committeeLogo && (
                      <button
                        type="button"
                        onClick={() => setCommitteeLogo(null)}
                        className="min-h-[38px] px-3 rounded-xl border border-red-200 dark:border-red-900/50 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCommitteeModalOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || encodingLogo}
                  className="min-h-[42px] px-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-xs font-semibold text-white cursor-pointer"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingCommittee ? 'Save Changes' : 'Create Committee'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE COMMITTEE CONFIRMATION MODAL */}
      {deleteCommitteeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Delete Committee?
            </h2>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong>{deleteCommitteeTarget.name}</strong>? It will
              be removed from the Student portal and dropdown lists.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCommitteeTarget(null)}
                className="min-h-[40px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDeleteCommittee}
                className="min-h-[40px] px-4 inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-xs font-semibold text-white cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD COMMITTEE MEMBER MODAL */}
      {createMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Add Committee Member
              </h2>
              <button
                type="button"
                onClick={() => setCreateMemberOpen(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Account will be created without signing you out, assigned to a committee, and forced
              to change password on first login.
            </p>

            {committees.length === 0 ? (
              <div className="mt-5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200 leading-relaxed">
                  Abhi koi committee nahi hai. Please create at least one committee first before
                  adding a committee member.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateMemberOpen(false)}
                    className="min-h-[38px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateMemberOpen(false);
                      openAddCommitteeModal();
                    }}
                    className="min-h-[38px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-xs font-semibold text-white cursor-pointer"
                  >
                    Add Committee First
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateMember} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="e.g. Prof. Priya Deshmukh"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Real Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="member@college.edu.in"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Temporary Password (min 8 chars)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={memberPassword}
                    onChange={(e) => setMemberPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Committee
                  </label>
                  <select
                    required
                    value={memberCommittee}
                    onChange={(e) => setMemberCommittee(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateMemberOpen(false)}
                    className="min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !memberCommittee}
                    className="min-h-[42px] px-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-xs font-semibold text-white cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Add Member</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* RESET MEMBER PASSWORD MODAL */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Reset Member Password
            </h2>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Force <strong>{resetTarget.email || resetTarget.name}</strong> to set a new password
              on next sign in, or send them a Firebase password reset link directly to their email.
            </p>
            <form onSubmit={handleResetPassword} className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="min-h-[40px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              {resetTarget.email && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSendMemberResetEmail}
                  className="min-h-[40px] px-4 inline-flex items-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer"
                >
                  <span>Send Reset Email</span>
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[40px] px-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-xs font-semibold text-white cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Require New Password</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN CREATE / EDIT NOTICE MODAL */}
      {(createNoticeOpen || editNoticeModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editNoticeModal ? 'Edit Notice' : 'Publish Notice to Committee'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setCreateNoticeOpen(false);
                  setEditNoticeModal(null);
                }}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {!editNoticeModal && committees.length === 0 ? (
              <div className="mt-5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                  Abhi koi committee nahi hai. Create a committee first before publishing a notice.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateNoticeOpen(false)}
                    className="min-h-[38px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateNoticeOpen(false);
                      openAddCommitteeModal();
                    }}
                    className="min-h-[38px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-xs font-semibold text-white cursor-pointer"
                  >
                    Add Committee
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveAdminNotice} className="mt-4 space-y-4">
                {!editNoticeModal && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      Committee
                    </label>
                    <select
                      required
                      value={noticeCommitteeId}
                      onChange={(e) => setNoticeCommitteeId(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white"
                    >
                      {committees.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={noticeDesc}
                    onChange={(e) => setNoticeDesc(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3.5 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateNoticeOpen(false);
                      setEditNoticeModal(null);
                    }}
                    className="min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || (!editNoticeModal && !noticeCommitteeId)}
                    className="min-h-[42px] px-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-xs font-semibold text-white cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{editNoticeModal ? 'Save Changes' : 'Publish'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
