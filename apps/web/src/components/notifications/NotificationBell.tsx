'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { notificationsApi, NotificationItem } from '../../lib/notifications-api';

const CATEGORY_ICONS: Record<string, string> = {
  admissions: '🎓', scholarships: '💰', roadmap: '🧭', financial: '📊',
  ai_suggestions: '✨', account: '👤', system: '⚙️', announcements: '📣',
};

const CATEGORY_LABELS: Record<string, string> = {
  admissions: 'Admissions', scholarships: 'Scholarships', roadmap: 'Career Roadmap', financial: 'Financial Planner',
  ai_suggestions: 'AI Suggestions', account: 'Account', system: 'System', announcements: 'Announcements',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const { isAuthenticated, accessToken } = useUserAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const lastNotifiedId = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const { count } = await notificationsApi.unreadCount(accessToken);
        if (!cancelled) setUnreadCount(count);
      } catch {
        // Non-fatal — badge just stays stale until the next successful poll.
      }
    };

    poll();
    const interval = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isAuthenticated, accessToken]);

  // Browser-notification opt-in: fires a native Notification for the newest
  // unread item, but only when the dispatch pipeline actually enabled the
  // 'browser' channel for it (preference-gated server-side already).
  useEffect(() => {
    if (!isAuthenticated || typeof window === 'undefined' || !('Notification' in window)) return;
    if (window.Notification.permission !== 'granted') return;
    const top = items.find(n => !n.isRead && n.channels.includes('browser'));
    if (top && top.id !== lastNotifiedId.current) {
      lastNotifiedId.current = top.id;
      new window.Notification(top.title, { body: top.message, tag: top.id });
    }
  }, [items, isAuthenticated]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const { notifications } = await notificationsApi.list({ limit: 8 }, accessToken);
        setItems(notifications);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleItemClick = async (n: NotificationItem) => {
    if (!n.isRead) {
      setItems(prev => prev.map(i => i.id === n.id ? { ...i, isRead: true } : i));
      setUnreadCount(c => Math.max(0, c - 1));
      notificationsApi.markRead(n.id, accessToken).catch(() => null);
    }
    setOpen(false);
  };

  const handleMarkAllRead = async () => {
    setItems(prev => prev.map(i => ({ ...i, isRead: true })));
    setUnreadCount(0);
    await notificationsApi.markAllRead(accessToken).catch(() => null);
  };

  const handleMarkReadOnly = (e: React.MouseEvent, n: NotificationItem) => {
    e.preventDefault();
    e.stopPropagation();
    setItems(prev => prev.map(i => i.id === n.id ? { ...i, isRead: true } : i));
    setUnreadCount(c => Math.max(0, c - 1));
    notificationsApi.markRead(n.id, accessToken).catch(() => null);
  };

  const handleArchive = (e: React.MouseEvent, n: NotificationItem) => {
    e.preventDefault();
    e.stopPropagation();
    setItems(prev => prev.filter(i => i.id !== n.id));
    if (!n.isRead) setUnreadCount(c => Math.max(0, c - 1));
    notificationsApi.archive(n.id, true, accessToken).catch(() => null);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="notif-bell-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="notif-bell-trigger"
        onClick={toggleOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        🔔
        {unreadCount > 0 && <span key={unreadCount} className="notif-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-bell-panel card-editorial" role="menu" aria-label="Notifications">
          <div className="notif-bell-panel-header">
            <span className="font-serif" style={{ fontSize: '16px', fontWeight: 600 }}>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notif-bell-mark-all" onClick={handleMarkAllRead}>Mark all read</button>
            )}
          </div>

          <div className="notif-bell-list">
            {loading && <p className="notif-bell-empty">Loading…</p>}
            {!loading && items.length === 0 && <p className="notif-bell-empty">You&apos;re all caught up.</p>}
            {!loading && items.map(n => (
              <Link
                key={n.id}
                href={n.actionUrl || '/notifications'}
                role="menuitem"
                className="notif-bell-item"
                data-unread={!n.isRead}
                onClick={() => handleItemClick(n)}
              >
                <span className="notif-bell-item-icon">{n.icon || CATEGORY_ICONS[n.category] || '🔔'}</span>
                <span className="notif-bell-item-body">
                  <span className="notif-bell-item-title-row">
                    <span className="notif-bell-item-title">{n.title}</span>
                    <span className="badge-editorial notif-bell-item-category">{CATEGORY_LABELS[n.category] || n.category}</span>
                  </span>
                  <span className="notif-bell-item-message">{n.message}</span>
                  <span className="notif-bell-item-time">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.isRead && <span className="notif-bell-item-dot" />}
                <span className="notif-bell-item-actions">
                  {!n.isRead && (
                    <button type="button" className="notif-bell-item-action" title="Mark as read" aria-label="Mark as read" onClick={e => handleMarkReadOnly(e, n)}>✓</button>
                  )}
                  <button type="button" className="notif-bell-item-action" title="Archive" aria-label="Archive notification" onClick={e => handleArchive(e, n)}>🗄</button>
                </span>
              </Link>
            ))}
          </div>

          <Link href="/notifications" className="notif-bell-view-all" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
