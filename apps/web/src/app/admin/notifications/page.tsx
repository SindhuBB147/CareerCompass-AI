'use client';

import React, { useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import {
  adminNotificationsApi, EmailTemplateSummary, DeliveryLogEntry, NotificationCategory, NotificationPriority,
} from '../../../lib/notifications-api';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';
import { AdminModal } from '../../../components/admin/AdminModal';

type Tab = 'send' | 'templates' | 'delivery';

const CATEGORIES: NotificationCategory[] = ['admissions', 'scholarships', 'roadmap', 'financial', 'ai_suggestions', 'account', 'system', 'announcements'];
const PRIORITIES: NotificationPriority[] = ['low', 'medium', 'high', 'urgent'];

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<Tab>('send');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Notifications</h1>
          <p className="admin-page-subtitle">Broadcast announcements, manage email templates, and review delivery status.</p>
        </div>
      </div>

      <div className="admin-tabs">
        <button type="button" className="admin-tab" data-active={tab === 'send'} onClick={() => setTab('send')}>Send</button>
        <button type="button" className="admin-tab" data-active={tab === 'templates'} onClick={() => setTab('templates')}>Email Templates</button>
        <button type="button" className="admin-tab" data-active={tab === 'delivery'} onClick={() => setTab('delivery')}>Delivery Status</button>
      </div>

      {tab === 'send' && <SendTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'delivery' && <DeliveryTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Send tab — broadcast / targeted / announcement
// ═══════════════════════════════════════════════════════════════════════════

function SendTab() {
  const { adminToken } = useAdminAuth();
  const [mode, setMode] = useState<'broadcast' | 'targeted' | 'announcement'>('announcement');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('announcements');
  const [priority, setPriority] = useState<NotificationPriority>('medium');
  const [userIdsRaw, setUserIdsRaw] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) { setError('Title and message are required.'); return; }
    setSending(true);
    setError(null);
    setResult(null);
    try {
      if (mode === 'broadcast') {
        const { recipients } = await adminNotificationsApi.broadcast({ title, message, category, priority }, adminToken);
        setResult(`Broadcast sent to ${recipients} student(s).`);
      } else if (mode === 'announcement') {
        const { recipients } = await adminNotificationsApi.announcement({ title, message, priority }, adminToken);
        setResult(`Announcement sent to ${recipients} student(s).`);
      } else {
        const userIds = userIdsRaw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
        if (userIds.length === 0) { setError('Enter at least one student ID.'); setSending(false); return; }
        const { recipients } = await adminNotificationsApi.targeted({ userIds, title, message, category, priority }, adminToken);
        setResult(`Sent to ${recipients} of ${userIds.length} requested student(s).`);
      }
      setTitle(''); setMessage(''); setUserIdsRaw('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="card-editorial" onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '620px' }}>
      <div className="admin-tabs" style={{ marginBottom: '4px' }}>
        <button type="button" className="admin-tab" data-active={mode === 'announcement'} onClick={() => setMode('announcement')}>Announcement (all)</button>
        <button type="button" className="admin-tab" data-active={mode === 'broadcast'} onClick={() => setMode('broadcast')}>Broadcast (all, categorized)</button>
        <button type="button" className="admin-tab" data-active={mode === 'targeted'} onClick={() => setMode('targeted')}>Targeted (specific students)</button>
      </div>

      {result && <div className="admin-inline-message" data-tone="success">{result}</div>}
      {error && <div className="admin-inline-message" data-tone="error">{error}</div>}

      {mode === 'targeted' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
          Student IDs (comma or newline separated)
          <textarea className="input-editorial" rows={3} value={userIdsRaw} onChange={e => setUserIdsRaw(e.target.value)} />
        </label>
      )}

      {mode !== 'announcement' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            Category
            <select className="input-editorial" value={category} onChange={e => setCategory(e.target.value as NotificationCategory)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            Priority
            <select className="input-editorial" value={priority} onChange={e => setPriority(e.target.value as NotificationPriority)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>
      )}
      {mode === 'announcement' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
          Priority
          <select className="input-editorial" value={priority} onChange={e => setPriority(e.target.value as NotificationPriority)}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
        Title
        <input type="text" className="input-editorial" value={title} onChange={e => setTitle(e.target.value)} maxLength={150} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
        Message
        <textarea className="input-editorial" rows={4} value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} />
      </label>

      <button type="submit" className="btn-editorial-primary" disabled={sending} style={{ alignSelf: 'flex-start' }}>
        {sending ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Templates tab
// ═══════════════════════════════════════════════════════════════════════════

function TemplatesTab() {
  const { adminToken } = useAdminAuth();
  const [templates, setTemplates] = useState<EmailTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EmailTemplateSummary | null>(null);
  const [form, setForm] = useState({ name: '', subject: '', htmlBody: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setTemplates(await adminNotificationsApi.listTemplates(adminToken)); }
    catch { setTemplates([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const openEdit = (t: EmailTemplateSummary) => {
    setEditing(t);
    setForm({ name: t.name, subject: t.subject, htmlBody: t.htmlBody, isActive: t.isActive });
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await adminNotificationsApi.upsertTemplate(editing.key, form, adminToken);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save template.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (key: string) => {
    if (!confirm('Reset this template to its built-in default?')) return;
    await adminNotificationsApi.resetTemplate(key, adminToken);
    await load();
  };

  const columns: AdminTableColumn<EmailTemplateSummary>[] = [
    { key: 'name', label: 'Template' },
    { key: 'subject', label: 'Subject' },
    { key: 'category', label: 'Category', render: t => t.category ?? '—' },
    { key: 'isOverridden', label: 'Status', render: t => t.isOverridden ? <span className="admin-status-badge admin-status-info">Customized</span> : <span style={{ color: 'var(--text-muted)' }}>Default</span> },
  ];

  return (
    <>
      <AdminTable
        columns={columns}
        rows={templates}
        rowKey={t => t.key}
        isLoading={loading}
        emptyMessage="No templates found."
        rowActions={t => (
          <>
            <button className="admin-table-action-btn" onClick={() => openEdit(t)}>Edit</button>
            {t.isOverridden && <button className="admin-table-action-btn" data-danger onClick={() => handleReset(t.key)}>Reset</button>}
          </>
        )}
      />

      {editing && (
        <AdminModal title={`Edit: ${editing.name}`} onClose={() => setEditing(null)} onSubmit={handleSave} isSubmitting={saving} error={error} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              Subject
              <input type="text" className="input-editorial" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              HTML body ({'{{variable}}'} placeholders)
              <textarea className="notif-admin-template-body" value={form.htmlBody} onChange={e => setForm({ ...form, htmlBody: e.target.value })} />
            </label>
            <label className="auth-checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          </div>
        </AdminModal>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Delivery status tab
// ═══════════════════════════════════════════════════════════════════════════

function DeliveryTab() {
  const { adminToken } = useAdminAuth();
  const [logs, setLogs] = useState<DeliveryLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    adminNotificationsApi.deliveryStatus({ status: status || undefined, page, limit }, adminToken)
      .then(r => { setLogs(r.logs); setTotal(r.total); })
      .catch(() => { setLogs([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [adminToken, status, page]);

  const columns: AdminTableColumn<DeliveryLogEntry>[] = [
    { key: 'channel', label: 'Channel' },
    { key: 'status', label: 'Status', render: l => (
      <span className={`admin-status-badge ${l.status === 'sent' ? 'admin-status-success' : l.status === 'failed' ? 'admin-status-danger' : 'admin-status-neutral'}`}>{l.status}</span>
    ) },
    { key: 'userId', label: 'User ID' },
    { key: 'error', label: 'Error', render: l => l.error ?? '—' },
    { key: 'attemptedAt', label: 'Attempted', render: l => new Date(l.attemptedAt).toLocaleString('en-IN') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '10px' }}>
        <select className="input-editorial" style={{ width: 'auto' }} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>
      <AdminTable
        columns={columns}
        rows={logs}
        rowKey={l => l.id}
        isLoading={loading}
        emptyMessage="No delivery attempts logged yet."
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        onPageChange={setPage}
        totalCount={total}
      />
    </div>
  );
}
