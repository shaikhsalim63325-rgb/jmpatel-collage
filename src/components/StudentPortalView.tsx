import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
} from 'lucide-react';
import { getCommitteeName } from '../data/committees';
import * as api from '../services/api';
import type { Committee, EventItem, GalleryItem, Notice } from '../types/portal';
import { NoticeErrorBoundary } from './NoticeErrorBoundary';
import { ResilientImage } from './ResilientImage';

export type StudentSection = 'home' | 'notices' | 'events' | 'gallery';

interface StudentPortalViewProps {
  activeSection: StudentSection;
  onChangeSection: (section: StudentSection) => void;
  committees: Committee[];
  notices: Notice[];
  noticesError?: string | null;
  events: EventItem[];
  gallery: GalleryItem[];
  loading: boolean;
}

function safeText(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return '';
}

function formatNoticeDate(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'abhi';
  }
  try {
    let dateObj: Date | null = null;
    if (
      typeof value === 'object' &&
      'toDate' in value &&
      typeof (value as { toDate: () => Date }).toDate === 'function'
    ) {
      dateObj = (value as { toDate: () => Date }).toDate();
    } else if (
      typeof value === 'object' &&
      'seconds' in value &&
      typeof (value as { seconds: unknown }).seconds === 'number'
    ) {
      dateObj = new Date((value as { seconds: number }).seconds * 1000);
    } else if (value instanceof Date) {
      dateObj = value;
    } else if (typeof value === 'string' || typeof value === 'number') {
      dateObj = new Date(value);
    }
    if (!dateObj || Number.isNaN(dateObj.getTime())) {
      return 'abhi';
    }
    return dateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch (err) {
    console.error('Error formatting notice date:', err);
    return 'abhi';
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'abhi';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'abhi';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isImageAttachment(fileUrl: string | null | undefined, fileName?: string | null): boolean {
  if (!fileUrl) return false;
  if (fileUrl.startsWith('data:image/')) return true;
  const target = (fileName || fileUrl).toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(target);
}

function triggerSafeAttachmentOpen(fileUrl: string, fileName?: string | null): string | null {
  try {
    if (fileUrl.startsWith('data:')) {
      const commaIdx = fileUrl.indexOf(',');
      if (commaIdx === -1) return 'Attachment format invalid hai.';
      const header = fileUrl.slice(5, commaIdx);
      const mimeType = header.split(';')[0] || 'application/octet-stream';
      const isBase64 = header.includes(';base64');
      const payload = fileUrl.slice(commaIdx + 1);
      const byteStr = isBase64 ? atob(payload) : decodeURIComponent(payload);
      const bytes = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) {
        bytes[i] = byteStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = (fileName || 'notice-attachment').trim() || 'notice-attachment';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      return null;
    }

    const link = document.createElement('a');
    link.href = fileUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return null;
  } catch (err) {
    console.error('Failed to open notice attachment:', err);
    return err instanceof Error ? err.message : 'Attachment open nahi ho paaya.';
  }
}

interface NoticeDetailContentProps {
  noticeId: string;
  fallbackNotice: Notice | null;
  committees: Committee[];
  backLabel: string;
  onBack: () => void;
  reloadToken: number;
  onRetry: () => void;
}

const NoticeDetailContent: React.FC<NoticeDetailContentProps> = ({
  noticeId,
  fallbackNotice,
  committees,
  backLabel,
  onBack,
  reloadToken,
  onRetry,
}) => {
  const [notice, setNotice] = useState<Notice | null>(fallbackNotice);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setAttachmentError(null);

    (async () => {
      try {
        const fresh = await api.fetchNoticeById(noticeId);
        if (!cancelled) {
          setNotice(fresh);
          setLoadError(null);
        }
      } catch (err) {
        console.error('Notice detail load error:', err);
        if (!cancelled) {
          setLoadError(api.extractReadableErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [noticeId, reloadToken]);

  const activeNotice = notice;
  const safeTitle = safeText(activeNotice?.title).trim() || 'Untitled Notice';
  const safeDescription =
    safeText(activeNotice?.description).trim() || 'Is notice me koi vivaran nahi diya gaya hai.';
  const safeFileUrl = safeText(activeNotice?.file_url).trim() || null;
  const safeFileName = safeText(activeNotice?.file_name).trim() || 'View / Download Attachment';
  const safeDateLabel = formatNoticeDate(activeNotice?.created_at);
  const safeCommitteeName = getCommitteeName(committees, activeNotice?.committee_id);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 min-h-[40px] px-3 -ml-3 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>{backLabel}</span>
      </button>

      {loading && !activeNotice ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 animate-pulse">
          <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-7 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-24 w-full rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Notice load nahi hua
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Firestore se notice padhne me samasya aayi. Neeche asli error details dekhein:
              </p>
              <p className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-3.5 py-2.5 text-xs font-mono text-red-700 dark:text-red-300 break-words">
                {loadError}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onRetry}
                  className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 text-xs font-semibold text-white cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Dobara Koshish Karein</span>
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{backLabel}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : !activeNotice ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
          <FileText className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
          <h1 className="mt-2 text-base font-bold text-slate-900 dark:text-white">
            Notice load nahi hua
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Yeh notice uplabdh nahi hai ya delete kar diya gaya hai.
          </p>
        </div>
      ) : (
        <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span className="font-semibold text-blue-700 dark:text-blue-400">
                {safeCommitteeName}
              </span>
              <span aria-hidden="true">·</span>
              <span>{safeDateLabel}</span>
            </div>
            <h1 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white break-words">
              {safeTitle}
            </h1>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line break-words">
              {safeDescription}
            </p>
          </div>

          {safeFileUrl && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              {isImageAttachment(safeFileUrl, safeFileName) && (
                <div className="max-w-xl rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  <ResilientImage
                    src={safeFileUrl}
                    alt={safeFileName}
                    className="w-full max-h-96 object-contain"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const err = triggerSafeAttachmentOpen(safeFileUrl, safeFileName);
                    setAttachmentError(err);
                  }}
                  className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 text-xs font-semibold text-blue-700 dark:text-blue-400 cursor-pointer"
                >
                  {safeFileUrl.startsWith('data:') ? (
                    <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate max-w-[240px]">{safeFileName}</span>
                </button>
              </div>

              {attachmentError && (
                <p className="text-xs text-red-600 dark:text-red-400">{attachmentError}</p>
              )}
            </div>
          )}
        </article>
      )}
    </div>
  );
};

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  activeSection,
  onChangeSection,
  committees,
  notices,
  noticesError,
  events,
  gallery,
  loading,
}) => {
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string | null>(null);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [noticeReloadToken, setNoticeReloadToken] = useState(0);
  const [committeeDetailTab, setCommitteeDetailTab] = useState<'notices' | 'events' | 'gallery'>('notices');
  const [searchQuery, setSearchQuery] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState<string>('all');

  const selectedCommittee = useMemo(
    () => committees.find((c) => c.id === selectedCommitteeId) || null,
    [committees, selectedCommitteeId]
  );

  const selectedNoticeFallback = useMemo(
    () => (selectedNoticeId ? notices.find((n) => n.id === selectedNoticeId) || null : null),
    [notices, selectedNoticeId]
  );

  const committeeCounts = useMemo(() => {
    const map = new Map<string, { notices: number; events: number; gallery: number }>();
    for (const c of committees) {
      map.set(c.id, { notices: 0, events: 0, gallery: 0 });
    }
    for (const n of notices) {
      const entry = map.get(n.committee_id);
      if (entry) entry.notices++;
    }
    for (const e of events) {
      const entry = map.get(e.committee_id);
      if (entry) entry.events++;
    }
    for (const g of gallery) {
      const entry = map.get(g.committee_id);
      if (entry) entry.gallery++;
    }
    return map;
  }, [committees, notices, events, gallery]);

  const filteredNotices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notices.filter((n) => {
      if (committeeFilter !== 'all' && n.committee_id !== committeeFilter) return false;
      if (!q) return true;
      const cName = getCommitteeName(committees, n.committee_id).toLowerCase();
      return (
        safeText(n.title).toLowerCase().includes(q) ||
        safeText(n.description).toLowerCase().includes(q) ||
        cName.includes(q)
      );
    });
  }, [notices, committeeFilter, searchQuery, committees]);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((ev) => {
      if (committeeFilter !== 'all' && ev.committee_id !== committeeFilter) return false;
      if (!q) return true;
      return (
        safeText(ev.title).toLowerCase().includes(q) ||
        safeText(ev.description).toLowerCase().includes(q) ||
        safeText(ev.venue).toLowerCase().includes(q)
      );
    });
  }, [events, committeeFilter, searchQuery]);

  const filteredGallery = useMemo(() => {
    return gallery.filter((g) => committeeFilter === 'all' || g.committee_id === committeeFilter);
  }, [gallery, committeeFilter]);

  const filteredCommittees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return committees;
    return committees.filter(
      (c) =>
        safeText(c.name).toLowerCase().includes(q) ||
        safeText(c.description).toLowerCase().includes(q) ||
        safeText(c.department_group).toLowerCase().includes(q)
    );
  }, [committees, searchQuery]);

  // Notice Detail Screen (guarded by NoticeErrorBoundary so errors stay in-place and never bounce to homepage)
  if (selectedNoticeId) {
    const backLabel = selectedCommittee
      ? `Back to ${selectedCommittee.name}`
      : 'Back to Notices';
    const handleBackFromNotice = () => {
      setSelectedNoticeId(null);
    };

    return (
      <NoticeErrorBoundary
        resetKey={`${selectedNoticeId}_${noticeReloadToken}`}
        onBack={handleBackFromNotice}
        onRetry={() => setNoticeReloadToken((prev) => prev + 1)}
      >
        <NoticeDetailContent
          noticeId={selectedNoticeId}
          fallbackNotice={selectedNoticeFallback}
          committees={committees}
          backLabel={backLabel}
          onBack={handleBackFromNotice}
          reloadToken={noticeReloadToken}
          onRetry={() => setNoticeReloadToken((prev) => prev + 1)}
        />
      </NoticeErrorBoundary>
    );
  }

  // Committee Detail Sub-view
  if (selectedCommittee) {
    const cNotices = notices.filter((n) => n.committee_id === selectedCommittee.id);
    const cEvents = events.filter((e) => e.committee_id === selectedCommittee.id);
    const cGallery = gallery.filter((g) => g.committee_id === selectedCommittee.id);

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <button
            type="button"
            onClick={() => setSelectedCommitteeId(null)}
            className="self-start inline-flex items-center gap-2 min-h-[40px] px-3 -ml-3 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>All Committees</span>
          </button>

          <div className="flex items-start gap-4">
            {selectedCommittee.logo_url && (
              <div className="w-16 h-16 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white p-1.5 shrink-0 overflow-hidden">
                <ResilientImage
                  src={selectedCommittee.logo_url}
                  alt={selectedCommittee.name}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
                {selectedCommittee.department_group || 'College Committee'}
              </p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                {selectedCommittee.name}
              </h1>
              <p className="mt-2 max-w-3xl text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedCommittee.description}
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span>{cNotices.length} Notices</span>
                <span aria-hidden="true">·</span>
                <span>{cEvents.length} Upcoming Events</span>
                <span aria-hidden="true">·</span>
                <span>{cGallery.length} Gallery Photos</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl self-start">
            {(['notices', 'events', 'gallery'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCommitteeDetailTab(tab)}
                className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  committeeDetailTab === tab
                    ? 'bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {committeeDetailTab === 'notices' && (
          <div className="space-y-3">
            {noticesError && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-4 text-xs text-red-700 dark:text-red-300"
              >
                <p className="font-semibold">Notice load nahi hua</p>
                <p className="mt-1 break-words">{noticesError}</p>
              </div>
            )}
            {cNotices.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                  No published notices yet
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Official circulars from {selectedCommittee.name} will appear here once published.
                </p>
              </div>
            ) : (
              cNotices.map((notice) => (
                <article
                  key={notice.id}
                  onClick={() => setSelectedNoticeId(notice.id)}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-600 transition-colors p-5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{selectedCommittee.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatNoticeDate(notice.created_at)}</span>
                    </div>
                    <span className="text-blue-700 dark:text-blue-400 font-semibold inline-flex items-center gap-1 shrink-0">
                      <span>Open</span>
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-semibold text-slate-900 dark:text-white">
                    {safeText(notice.title).trim() || 'Untitled Notice'}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                    {safeText(notice.description).trim() || 'No description provided.'}
                  </p>
                  {notice.file_url && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{safeText(notice.file_name).trim() || 'Attachment included'}</span>
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
        )}

        {committeeDetailTab === 'events' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cEvents.length === 0 ? (
              <div className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                  No scheduled events
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Upcoming workshops, fests, and drives for {selectedCommittee.name} will be listed here.
                </p>
              </div>
            ) : (
              cEvents.map((ev) => (
                <article
                  key={ev.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
                >
                  <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400 font-medium tabular-nums">
                    <span>{formatDate(ev.date)}</span>
                    {ev.venue && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-500 dark:text-slate-400">{ev.venue}</span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-1.5 text-base font-semibold text-slate-900 dark:text-white">
                    {ev.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {ev.description}
                  </p>
                </article>
              ))
            )}
          </div>
        )}

        {committeeDetailTab === 'gallery' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cGallery.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
                <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                  No gallery photos yet
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Photographs from {selectedCommittee.name} activities will appear here.
                </p>
              </div>
            ) : (
              cGallery.map((item) => (
                <figure
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <ResilientImage
                      src={item.image_url}
                      alt={item.caption || selectedCommittee.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <figcaption className="p-4">
                    <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2">
                      {item.caption || 'Campus Event Moment'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {formatDate(item.created_at)}
                    </p>
                  </figcaption>
                </figure>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // Home View: Campus Banner + Committees Directory
  if (activeSection === 'home') {
    return (
      <div className="space-y-8">
        {/* Hero Split */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                SKM&apos;S J.M. Patel College of Commerce · Mumbai-90
              </p>
              <h1 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                Campus Committees, Notices &amp; Student Activities
              </h1>
              <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Official portal for verified circulars, upcoming events, and photo galleries across
                SKM&apos;S J.M. Patel College of Commerce committees.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onChangeSection('notices')}
                className="min-h-[44px] px-5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Browse Notices Feed
              </button>
              <button
                type="button"
                onClick={() => onChangeSection('events')}
                className="min-h-[44px] px-5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Upcoming Events
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-50/80 dark:bg-slate-800/40 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 p-6 sm:p-7 flex flex-col items-center justify-center text-center">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-white p-2.5 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
              <img
                src="/assets/aistudio/image_7a27b95d.png"
                alt="SKM'S J.M. Patel College of Commerce Seal"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="mt-4 space-y-1.5 max-w-md">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Sanskardham Kelavani Mandal&apos;s
              </p>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                SKM&apos;S J.M. Patel College of Commerce
              </h2>
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 pt-0.5">
                Gujarati Linguistic Minority Institute
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Affiliated to University of Mumbai and Recognized u/s(f) and 12(b) by UGC
              </p>
            </div>

            <div className="mt-4 pt-3.5 border-t border-slate-200/80 dark:border-slate-700/80 w-full flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-slate-700 dark:text-slate-200">
              <a
                href="tel:+918779494145"
                className="inline-flex items-center gap-1.5 hover:text-blue-700 dark:hover:text-blue-400 transition-colors tabular-nums"
              >
                <Phone className="w-3.5 h-3.5 text-blue-800 dark:text-blue-400 shrink-0" aria-hidden="true" />
                <span>+91 87794 94145</span>
              </a>
              <a
                href="mailto:jmpcollege@gmail.com"
                className="inline-flex items-center gap-1.5 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-blue-800 dark:text-blue-400 shrink-0" aria-hidden="true" />
                <span>jmpcollege@gmail.com</span>
              </a>
            </div>
          </div>
        </section>

        {/* Summary KPI strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Committees</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {committees.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Published Notices</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {notices.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Upcoming Events</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {events.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Gallery Photos</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {gallery.length}
            </p>
          </div>
        </section>

        {/* Committees Grid */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                College Committees Directory
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {committees.length > 0
                  ? `Select any of the ${committees.length} committees to view notices, events, and photo galleries.`
                  : 'Official campus committees added by the Principal will appear here.'}
              </p>
            </div>
            {committees.length > 0 && (
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search committees..."
                  aria-label="Search committees"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-40 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 animate-pulse"
                />
              ))}
            </div>
          ) : committees.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                Abhi koi committee nahi hai
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Principal dwara nayi committee add hone ke baad yahan dikhegi.
              </p>
            </div>
          ) : filteredCommittees.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                No matching committees found
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCommittees.map((committee, index) => {
                const counts = committeeCounts.get(committee.id) || { notices: 0, events: 0, gallery: 0 };
                return (
                  <button
                    key={committee.id}
                    type="button"
                    onClick={() => {
                      setSelectedCommitteeId(committee.id);
                      setCommitteeDetailTab('notices');
                    }}
                    className="group text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-600 p-5 transition-colors flex flex-col justify-between gap-4 cursor-pointer"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {committee.logo_url && (
                            <div className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-1 shrink-0 overflow-hidden">
                              <ResilientImage
                                src={committee.logo_url}
                                alt={committee.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-blue-700 dark:text-blue-400 block truncate">
                              {committee.department_group || 'Committee'}
                            </span>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors truncate">
                              {committee.name}
                            </h3>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <p className="mt-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {committee.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>
                        {counts.notices} Notices · {counts.events} Events
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Shared Search & Committee Filter Bar for Notices / Events / Gallery views
  const filterHeader = (title: string, subtitle: string) => (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
        {activeSection !== 'gallery' && (
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title or keyword..."
              aria-label="Search feed"
              className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        )}
        <select
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
          aria-label="Filter by committee"
          className="min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="all">All Committees</option>
          {committees.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  if (activeSection === 'notices') {
    return (
      <div className="space-y-6">
        {filterHeader(
          'Campus Notices Feed',
          "Verified circulars and announcements published across SKM'S J.M. Patel College of Commerce committees."
        )}

        {noticesError && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-4 text-xs text-red-700 dark:text-red-300"
          >
            <p className="font-semibold">Notice load nahi hua</p>
            <p className="mt-1 break-words">{noticesError}</p>
          </div>
        )}

        {filteredNotices.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              No matching notices found
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Try clearing your search query or switching committee filters.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotices.map((notice) => (
              <article
                key={notice.id}
                onClick={() => setSelectedNoticeId(notice.id)}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-600 transition-colors p-5 cursor-pointer"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCommitteeId(notice.committee_id);
                      }}
                      className="font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {getCommitteeName(committees, notice.committee_id)}
                    </button>
                    <span aria-hidden="true">·</span>
                    <span>{formatNoticeDate(notice.created_at)}</span>
                  </div>
                  <span className="text-blue-700 dark:text-blue-400 font-semibold inline-flex items-center gap-1">
                    <span>Open</span>
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </div>
                <h2 className="mt-1.5 text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                  {safeText(notice.title).trim() || 'Untitled Notice'}
                </h2>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                  {safeText(notice.description).trim() || 'No description provided.'}
                </p>
                {notice.file_url && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{safeText(notice.file_name).trim() || 'Attachment included'}</span>
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeSection === 'events') {
    return (
      <div className="space-y-6">
        {filterHeader(
          'Upcoming Campus Events',
          'Workshops, cultural fests, seminars, and sports trials scheduled across committees.'
        )}

        {filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              No matching events scheduled
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvents.map((ev) => (
              <article
                key={ev.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <button
                      type="button"
                      onClick={() => setSelectedCommitteeId(ev.committee_id)}
                      className="font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {getCommitteeName(committees, ev.committee_id)}
                    </button>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(ev.date)}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-base font-bold text-slate-900 dark:text-white">
                    {ev.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {ev.description}
                  </p>
                </div>
                {ev.venue && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{ev.venue}</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Gallery View
  return (
    <div className="space-y-6">
      {filterHeader(
        'Campus Photo Gallery',
        'Highlights from committee drives, cultural showcases, and academic conventions.'
      )}

      {filteredGallery.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
          <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
            No gallery photos available
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGallery.map((item) => (
            <figure
              key={item.id}
              className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <ResilientImage
                  src={item.image_url}
                  alt={item.caption || getCommitteeName(committees, item.committee_id)}
                  className="w-full h-full object-cover"
                />
              </div>
              <figcaption className="p-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  <button
                    type="button"
                    onClick={() => setSelectedCommitteeId(item.committee_id)}
                    className="font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {getCommitteeName(committees, item.committee_id)}
                  </button>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(item.created_at)}</span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-slate-900 dark:text-white line-clamp-2">
                  {item.caption || 'Campus Event'}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
};
