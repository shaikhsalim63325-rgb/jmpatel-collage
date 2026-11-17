import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ExternalLink,
  FileText,
  FolderLock,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import * as api from '../services/api';
import type {
  Committee,
  DocumentItem,
  EventItem,
  GalleryItem,
  Notice,
  Profile,
} from '../types/portal';
import { ResilientImage } from './ResilientImage';

export type CommitteeTab = 'notices' | 'events' | 'gallery' | 'documents';

interface CommitteeDashboardProps {
  profile: Profile;
  committee: Committee | undefined;
  activeTab: CommitteeTab;
  onChangeTab: (tab: CommitteeTab) => void;
  notices: Notice[];
  events: EventItem[];
  gallery: GalleryItem[];
  documents: DocumentItem[];
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'abhi';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'abhi';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const CommitteeDashboard: React.FC<CommitteeDashboardProps> = ({
  profile,
  committee,
  activeTab,
  onChangeTab,
  notices,
  events,
  gallery,
  documents,
  onRefresh,
  onToast,
}) => {
  const committeeId = profile.committee_id || '';

  // Strict client-side scoping reinforcement (in addition to backend/RLS isolation)
  const ownNotices = useMemo(
    () => notices.filter((n) => n.committee_id === committeeId),
    [notices, committeeId]
  );
  const ownEvents = useMemo(
    () => events.filter((e) => e.committee_id === committeeId),
    [events, committeeId]
  );
  const ownGallery = useMemo(
    () => gallery.filter((g) => g.committee_id === committeeId),
    [gallery, committeeId]
  );
  const ownDocuments = useMemo(
    () => documents.filter((d) => d.committee_id === committeeId),
    [documents, committeeId]
  );

  // Notice Form State
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeDesc, setNoticeDesc] = useState('');
  const [noticeFile, setNoticeFile] = useState<File | null>(null);

  // Event Form State
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventVenue, setEventVenue] = useState('');

  // Gallery Form State
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [galleryCaption, setGalleryCaption] = useState('');
  const [galleryFile, setGalleryFile] = useState<File | null>(null);

  // Document Form State
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const openNoticeCreate = () => {
    setEditingNotice(null);
    setNoticeTitle('');
    setNoticeDesc('');
    setNoticeFile(null);
    setNoticeModalOpen(true);
  };

  const openNoticeEdit = (n: Notice) => {
    setEditingNotice(n);
    setNoticeTitle(n.title);
    setNoticeDesc(n.description);
    setNoticeFile(null);
    setNoticeModalOpen(true);
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!committeeId) return;
    setSubmitting(true);
    try {
      let file_url = editingNotice?.file_url ?? null;
      let file_name = editingNotice?.file_name ?? null;
      if (noticeFile) {
        const uploaded = await api.uploadCommitteeFile(committeeId, 'notices', noticeFile);
        file_url = uploaded.url;
        file_name = uploaded.fileName;
      }

      if (editingNotice) {
        await api.updateNotice(editingNotice.id, {
          title: noticeTitle,
          description: noticeDesc,
          file_url,
        });
        onToast('success', 'Notice updated');
      } else {
        await api.createNotice({
          committee_id: committeeId,
          title: noticeTitle,
          description: noticeDesc,
          file_url,
          file_name,
        });
        onToast('success', 'Notice published');
      }
      setNoticeModalOpen(false);
      await onRefresh();
    } catch (err) {
      onToast('error', 'Failed to save notice', err instanceof Error ? err.message : undefined);
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
      onToast('error', 'Could not delete notice', err instanceof Error ? err.message : undefined);
    }
  };

  const openEventCreate = () => {
    setEditingEvent(null);
    setEventTitle('');
    setEventDesc('');
    setEventDate('');
    setEventVenue('');
    setEventModalOpen(true);
  };

  const openEventEdit = (ev: EventItem) => {
    setEditingEvent(ev);
    setEventTitle(ev.title);
    setEventDesc(ev.description);
    setEventDate(ev.date);
    setEventVenue(ev.venue);
    setEventModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!committeeId) return;
    setSubmitting(true);
    try {
      if (editingEvent) {
        await api.updateEvent(editingEvent.id, {
          title: eventTitle,
          description: eventDesc,
          date: eventDate,
          venue: eventVenue,
        });
        onToast('success', 'Event updated');
      } else {
        await api.createEvent({
          committee_id: committeeId,
          title: eventTitle,
          description: eventDesc,
          date: eventDate,
          venue: eventVenue,
        });
        onToast('success', 'Event added');
      }
      setEventModalOpen(false);
      await onRefresh();
    } catch (err) {
      onToast('error', 'Failed to save event', err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await api.deleteEvent(id);
      onToast('success', 'Event removed');
      await onRefresh();
    } catch (err) {
      onToast('error', 'Could not delete event', err instanceof Error ? err.message : undefined);
    }
  };

  const handleUploadGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!committeeId || !galleryFile) return;
    setSubmitting(true);
    try {
      const uploaded = await api.uploadCommitteeFile(committeeId, 'gallery', galleryFile);
      await api.createGalleryItem({
        committee_id: committeeId,
        image_url: uploaded.url,
        caption: galleryCaption,
      });
      onToast('success', 'Photo added to gallery');
      setGalleryModalOpen(false);
      setGalleryCaption('');
      setGalleryFile(null);
      await onRefresh();
    } catch (err) {
      onToast('error', 'Gallery upload failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGallery = async (id: string) => {
    try {
      await api.deleteGalleryItem(id);
      onToast('success', 'Photo removed');
      await onRefresh();
    } catch (err) {
      onToast('error', 'Could not remove photo', err instanceof Error ? err.message : undefined);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!committeeId || !docFile) return;
    setSubmitting(true);
    try {
      const uploaded = await api.uploadCommitteeFile(committeeId, 'documents', docFile);
      await api.createDocument({
        committee_id: committeeId,
        title: docTitle,
        file_url: uploaded.url,
        file_name: uploaded.fileName,
      });
      onToast('success', 'Committee document uploaded');
      setDocModalOpen(false);
      setDocTitle('');
      setDocFile(null);
      await onRefresh();
    } catch (err) {
      onToast('error', 'Document upload failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await api.deleteDocument(id);
      onToast('success', 'Document deleted');
      await onRefresh();
    } catch (err) {
      onToast('error', 'Could not delete document', err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className="space-y-6">
      {/* Committee Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              Committee Workspace · Isolated Access
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {committee?.name || committeeId}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Signed in as {profile.name}
              {profile.email ? ` (${profile.email})` : ''} · Manage notices, events, gallery, and
              internal committee files.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'notices' && (
              <button
                type="button"
                onClick={openNoticeCreate}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Publish Notice</span>
              </button>
            )}
            {activeTab === 'events' && (
              <button
                type="button"
                onClick={openEventCreate}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Event</span>
              </button>
            )}
            {activeTab === 'gallery' && (
              <button
                type="button"
                onClick={() => setGalleryModalOpen(true)}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Photo</span>
              </button>
            )}
            {activeTab === 'documents' && (
              <button
                type="button"
                onClick={() => setDocModalOpen(true)}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Document</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary Strip */}
        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 tabular-nums">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Notices</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{ownNotices.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Events</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{ownEvents.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Gallery Photos</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{ownGallery.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Private Documents</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{ownDocuments.length}</p>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 overflow-x-auto">
        {(
          [
            { id: 'notices', label: 'Notices' },
            { id: 'events', label: 'Events' },
            { id: 'gallery', label: 'Gallery' },
            { id: 'documents', label: 'Documents' },
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

      {/* NOTICES TAB */}
      {activeTab === 'notices' && (
        <div className="space-y-3">
          {ownNotices.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                No notices published by {committee?.name}
              </p>
              <button
                type="button"
                onClick={openNoticeCreate}
                className="mt-4 min-h-[42px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
              >
                Publish First Notice
              </button>
            </div>
          ) : (
            ownNotices.map((n) => (
              <div
                key={n.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Published {formatDate(n.created_at)}
                  </p>
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
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{n.file_name || 'View Attachment'}</span>
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openNoticeEdit(n)}
                    aria-label="Edit notice"
                    className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNotice(n.id)}
                    aria-label="Delete notice"
                    className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* EVENTS TAB */}
      {activeTab === 'events' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ownEvents.length === 0 ? (
            <div className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                No events scheduled yet
              </p>
              <button
                type="button"
                onClick={openEventCreate}
                className="mt-4 min-h-[42px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
              >
                Schedule First Event
              </button>
            </div>
          ) : (
            ownEvents.map((ev) => (
              <div
                key={ev.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
              >
                <div>
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
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {ev.description}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEventEdit(ev)}
                    className="min-h-[38px] px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(ev.id)}
                    className="min-h-[38px] px-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* GALLERY TAB */}
      {activeTab === 'gallery' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ownGallery.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
              <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                No gallery photos uploaded
              </p>
              <button
                type="button"
                onClick={() => setGalleryModalOpen(true)}
                className="mt-4 min-h-[42px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
              >
                Upload First Photo
              </button>
            </div>
          ) : (
            ownGallery.map((g) => (
              <div
                key={g.id}
                className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800">
                  <ResilientImage
                    src={g.image_url}
                    alt={g.caption || 'Committee Gallery'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2">
                      {g.caption || 'Committee Photo'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {formatDate(g.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteGallery(g.id)}
                    aria-label="Delete photo"
                    className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PRIVATE DOCUMENTS TAB */}
      {activeTab === 'documents' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/30 px-4 py-3 flex items-center gap-2.5 text-xs text-blue-900 dark:text-blue-200">
            <FolderLock className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Internal committee documents are stored in your isolated{' '}
              <code className="font-mono">{committeeId}/documents/</code> folder and are hidden from
              students and other committees.
            </span>
          </div>

          {ownDocuments.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
              <FolderLock className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                No committee documents uploaded
              </p>
              <button
                type="button"
                onClick={() => setDocModalOpen(true)}
                className="mt-4 min-h-[42px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
              >
                Upload Committee Document
              </button>
            </div>
          ) : (
            ownDocuments.map((doc) => (
              <div
                key={doc.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {doc.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {doc.file_name || 'Document'} · {formatDate(doc.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDeleteDocument(doc.id)}
                    aria-label="Delete document"
                    className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* NOTICE MODAL */}
      {noticeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingNotice ? 'Edit Notice' : 'Publish Committee Notice'}
              </h2>
              <button
                type="button"
                onClick={() => setNoticeModalOpen(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveNotice} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Attachment (PDF or Image, optional)
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setNoticeFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 dark:file:bg-blue-950 file:text-blue-700 dark:file:text-blue-300 file:font-semibold"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoticeModalOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[42px] px-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-xs font-semibold text-white cursor-pointer"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingNotice ? 'Save Changes' : 'Publish Notice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVENT MODAL */}
      {eventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingEvent ? 'Edit Event' : 'Add Committee Event'}
              </h2>
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEvent} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Venue
                  </label>
                  <input
                    type="text"
                    required
                    value={eventVenue}
                    onChange={(e) => setEventVenue(e.target.value)}
                    placeholder="e.g. Main Auditorium"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[42px] px-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-xs font-semibold text-white cursor-pointer"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingEvent ? 'Save Event' : 'Create Event'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GALLERY MODAL */}
      {galleryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upload Gallery Photo</h2>
              <button
                type="button"
                onClick={() => setGalleryModalOpen(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUploadGallery} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Photo File
                </label>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => setGalleryFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 dark:file:bg-blue-950 file:text-blue-700 dark:file:text-blue-300 file:font-semibold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Caption
                </label>
                <input
                  type="text"
                  required
                  value={galleryCaption}
                  onChange={(e) => setGalleryCaption(e.target.value)}
                  placeholder="Describe the campus activity..."
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGalleryModalOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[42px] px-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-xs font-semibold text-white cursor-pointer"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Upload Photo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT MODAL */}
      {docModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Upload Committee Document
              </h2>
              <button
                type="button"
                onClick={() => setDocModalOpen(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUploadDocument} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Minutes of Meeting — Nov 2026"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  File (PDF, DOCX, Spreadsheet, or Image)
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 dark:file:bg-blue-950 file:text-blue-700 dark:file:text-blue-300 file:font-semibold"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDocModalOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[42px] px-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-xs font-semibold text-white cursor-pointer"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Upload Document</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
