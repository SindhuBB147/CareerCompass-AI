'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { Pagination } from '../../components/colleges/Pagination';
import {
  notificationsApi, NotificationItem, NotificationCategory, NotificationPriority, Reminder, ReminderType,
} from '../../lib/notifications-api';

const CATEGORY_TABS: Array<{ key: NotificationCategory | 'all' | 'favorites' | 'archived'; label: string; icon: string }> = [
  { key: 'all', label: 'All', icon: '🔔' },
  { key: 'admissions', label: 'Admissions', icon: '🎓' },
  { key: 'scholarships', label: 'Scholarships', icon: '💰' },
  { key: 'roadmap', label: 'Roadmap', icon: '🧭' },
  { key: 'financial', label: 'Financial', icon: '📊' },
  { key: 'ai_suggestions', label: 'AI Suggestions', icon: '✨' },
  { key: 'account', label: 'Account', icon: '👤' },
  { key: 'system', label: 'System', icon: '⚙️' },
  { key: 'announcements', label: 'Announcements', icon: '📣' },
  { key: 'favorites', label: '★ Favorites', icon: '' },
  { key: 'archived', label: 'Archived', icon: '' },
];

const CATEGORY_ICONS: Record<string, string> = {
  admissions: '🎓', scholarships: '💰', roadmap: '🧭', financial: '📊',
  ai_suggestions: '✨', account: '👤', system: '⚙️', announcements: '📣',
};

const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  counselling: 'Counselling', scholarship_deadline: 'Scholarship Deadline', roadmap_task: 'Roadmap Task',
  exam: 'Examination', document_submission: 'Document Submission', loan_payment: 'Loan Payment', custom: 'Custom',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated, isLoading: authLoading } = useUserAuth();

  const [view, setView] = useState<'notifications' | 'reminders'>('notifications');
  const [tab, setTab] = useState<typeof CATEGORY_TABS[number]['key']>('all');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<NotificationPriority | ''>('');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 15;

  const load = async () => {
    setLoading(true);
    try {
      const filters: Parameters<typeof notificationsApi.list>[0] = { page, limit, search: search || undefined, priority: priority || undefined };
      if (tab === 'favorites') filters.isFavorite = true;
      else if (tab === 'archived') filters.isArchived = true;
      else if (tab !== 'all') filters.category = tab;
      const result = await notificationsApi.list(filters, accessToken);
      setItems(result.notifications);
      setTotal(result.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/login/student'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, tab, page, priority]);

  useEffect(() => { setPage(1); }, [tab, priority]);

  const handleSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(); };

  const mutate = (id: string, patch: Partial<NotificationItem>) => setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  const handleRowClick = async (n: NotificationItem) => {
    if (!n.isRead) {
      mutate(n.id, { isRead: true });
      await notificationsApi.markRead(n.id, accessToken).catch(() => null);
    }
    if (n.actionUrl) router.push(n.actionUrl);
  };

  const handleFavorite = async (e: React.MouseEvent, n: NotificationItem) => {
    e.stopPropagation();
    mutate(n.id, { isFavorite: !n.isFavorite });
    await notificationsApi.favorite(n.id, !n.isFavorite, accessToken).catch(() => null);
  };

  const handleArchive = async (e: React.MouseEvent, n: NotificationItem) => {
    e.stopPropagation();
    await notificationsApi.archive(n.id, !n.isArchived, accessToken).catch(() => null);
    setItems(prev => prev.filter(i => i.id !== n.id));
  };

  const handleDelete = async (e: React.MouseEvent, n: NotificationItem) => {
    e.stopPropagation();
    if (!confirm('Delete this notification?')) return;
    await notificationsApi.remove(n.id, accessToken).catch(() => null);
    setItems(prev => prev.filter(i => i.id !== n.id));
  };

  const handleMarkAllRead = async () => {
    setItems(prev => prev.map(i => ({ ...i, isRead: true })));
    await notificationsApi.markAllRead(accessToken).catch(() => null);
  };

  if (authLoading) return <div className="container-editorial" style={{ padding: '80px 0' }}><p className="wizard-hint">Loading…</p></div>;

  return (
    <div className="container-editorial notif-center-page" style={{ padding: '48px 0 96px' }}>
      <div className="notif-center-header">
        <div>
          <span className="auth-eyebrow">Notification Center</span>
          <h1 className="text-section-title font-serif" style={{ marginTop: '4px' }}>Notifications</h1>
        </div>
        <div className="notif-center-toolbar">
          <button type="button" className="btn-editorial-secondary" data-active={view === 'notifications' || undefined} onClick={() => setView('notifications')}>
            Notifications
          </button>
          <button type="button" className="btn-editorial-secondary" data-active={view === 'reminders' || undefined} onClick={() => setView('reminders')}>
            My Reminders
          </button>
        </div>
      </div>

      {view === 'notifications' ? (
        <>
          <div className="notif-center-tabs">
            {CATEGORY_TABS.map(t => (
              <button key={t.key} type="button" className="notif-center-tab" data-active={tab === t.key} onClick={() => setTab(t.key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="notif-center-toolbar">
            <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: '220px' }}>
              <input
                type="search" className="input-editorial" placeholder="Search notifications…"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </form>
            <select className="input-editorial" style={{ width: 'auto' }} value={priority} onChange={e => setPriority(e.target.value as NotificationPriority | '')}>
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button type="button" className="btn-editorial-secondary" onClick={handleMarkAllRead}>Mark all read</button>
          </div>

          <div className="notif-center-list">
            {loading && <p className="wizard-hint">Loading…</p>}
            {!loading && items.length === 0 && (
              <div className="notif-empty-state card-editorial">
                <p style={{ fontSize: '17px', fontWeight: 500 }}>You're all caught up.</p>
                <p className="text-body" style={{ fontSize: '14px' }}>Nothing here for this view.</p>
              </div>
            )}
            {!loading && items.map(n => (
              <div key={n.id} className="card-editorial notif-center-row" data-unread={!n.isRead} onClick={() => handleRowClick(n)}>
                <span className="notif-center-row-icon">{n.icon || CATEGORY_ICONS[n.category] || '🔔'}</span>
                <div className="notif-center-row-body">
                  <div className="notif-center-row-top">
                    <span className="notif-center-row-title">{n.title}</span>
                    <span className={`notif-priority-pill notif-priority-${n.priority}`}>{n.priority}</span>
                  </div>
                  <p className="notif-center-row-message">{n.message}</p>
                  <div className="notif-center-row-meta">
                    <span>{formatDate(n.createdAt)}</span>
                    <span className="badge-editorial">{n.category.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className="notif-center-row-actions">
                  <button type="button" className="notif-center-icon-btn" data-active={n.isFavorite || undefined} title="Favorite" onClick={e => handleFavorite(e, n)}>★</button>
                  <button type="button" className="notif-center-icon-btn" title={n.isArchived ? 'Unarchive' : 'Archive'} onClick={e => handleArchive(e, n)}>🗄</button>
                  <button type="button" className="notif-center-icon-btn" title="Delete" onClick={e => handleDelete(e, n)}>✕</button>
                </div>
              </div>
            ))}
          </div>

          <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / limit))} onChange={setPage} />
        </>
      ) : (
        <RemindersPanel accessToken={accessToken} />
      )}
    </div>
  );
}

function RemindersPanel({ accessToken }: { accessToken: string | null }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<ReminderType>('custom');
  const [title, setTitle] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setReminders(await notificationsApi.listReminders(accessToken)); }
    catch { setReminders([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !remindAt) { setError('Title and date/time are required.'); return; }
    setSaving(true);
    setError(null);
    try {
      await notificationsApi.createReminder({ type, title, remindAt: new Date(remindAt).toISOString(), note: note || undefined }, accessToken);
      setTitle(''); setNote(''); setRemindAt(''); setShowForm(false);
      await load();
    } catch {
      setError('Could not create reminder. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    await notificationsApi.cancelReminder(id, accessToken).catch(() => null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="notif-center-toolbar" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn-editorial-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New Reminder'}
        </button>
      </div>

      {showForm && (
        <form className="card-editorial" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && <p style={{ color: '#B23A3A', fontSize: '13px' }}>{error}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              Type
              <select className="input-editorial" value={type} onChange={e => setType(e.target.value as ReminderType)}>
                {Object.entries(REMINDER_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              Remind me at
              <input type="datetime-local" className="input-editorial" value={remindAt} onChange={e => setRemindAt(e.target.value)} />
            </label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            Title
            <input type="text" className="input-editorial" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Submit income certificate" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            Note (optional)
            <textarea className="input-editorial" rows={2} value={note} onChange={e => setNote(e.target.value)} />
          </label>
          <button type="submit" className="btn-editorial-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? 'Saving…' : 'Create Reminder'}
          </button>
        </form>
      )}

      {loading && <p className="wizard-hint">Loading…</p>}
      {!loading && reminders.length === 0 && (
        <div className="notif-empty-state card-editorial">
          <p style={{ fontSize: '17px', fontWeight: 500 }}>No reminders set.</p>
        </div>
      )}
      <div className="notif-center-list">
        {reminders.map(r => (
          <div key={r.id} className="card-editorial notif-center-row">
            <span className="notif-center-row-icon">⏰</span>
            <div className="notif-center-row-body">
              <div className="notif-center-row-top">
                <span className="notif-center-row-title">{r.title}</span>
                <span className="badge-editorial">{REMINDER_TYPE_LABELS[r.type]}</span>
              </div>
              {r.note && <p className="notif-center-row-message">{r.note}</p>}
              <div className="notif-center-row-meta"><span>{formatDate(r.remindAt)}</span></div>
            </div>
            <div className="notif-center-row-actions">
              <button type="button" className="notif-center-icon-btn" title="Cancel" onClick={() => handleCancel(r.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
