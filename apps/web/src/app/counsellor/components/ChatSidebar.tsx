'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3, Building2, GraduationCap, History, MessageSquare, Pin, Plus, Search, Settings, SquarePen, TrendingUp, Wallet, X,
} from 'lucide-react';
import type { SessionSummary } from '../../../hooks/useAiCounsellorChat';
import { readPinnedIds, readSessionTitles, setSessionTitle, togglePinned } from '../../../lib/counsellor-storage';

interface Props {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onDelete: (sessionId: string) => void;
  mobileOpen: boolean;
  onCloseMobile?: () => void;
}

const QUICK_NAV = [
  { href: '/colleges', label: 'Colleges', icon: Building2 },
  { href: '/predictions', label: 'Predictions', icon: BarChart3 },
  { href: '/scholarships', label: 'Scholarships', icon: GraduationCap },
  { href: '/financial-planner', label: 'Financial Planner', icon: Wallet },
  { href: '/roadmap', label: 'Roadmap', icon: TrendingUp },
];

function SessionRow({
  session, isActive, isPinned, displayTitle, onSelect, onDelete, onTogglePin, onRename,
}: {
  session: SessionSummary; isActive: boolean; isPinned: boolean; displayTitle: string;
  onSelect: () => void; onDelete: () => void; onTogglePin: () => void; onRename: (title: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(displayTitle);

  const commitRename = () => {
    setRenaming(false);
    if (draft.trim() && draft.trim() !== displayTitle) onRename(draft.trim());
  };

  if (renaming) {
    return (
      <div className="chat-session-row" data-active={isActive}>
        <input
          className="chat-session-rename-input input-editorial"
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') { setDraft(displayTitle); setRenaming(false); }
          }}
          aria-label="Rename conversation"
        />
      </div>
    );
  }

  return (
    <div className="chat-session-row" data-active={isActive}>
      <button onClick={onSelect} className="chat-session-title-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <MessageSquare size={13} style={{ flexShrink: 0, color: isActive ? 'var(--accent-blue)' : 'var(--text-muted)' }} aria-hidden="true" />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayTitle}</span>
      </button>
      <button
        onClick={onTogglePin}
        className="chat-session-icon-btn"
        aria-pressed={isPinned}
        aria-label={isPinned ? 'Unpin conversation' : 'Pin conversation'}
        title={isPinned ? 'Unpin' : 'Pin'}
      >
        <Pin size={13} fill={isPinned ? 'currentColor' : 'none'} style={{ flexShrink: 0 }} />
      </button>
      <button
        onClick={() => { setDraft(displayTitle); setRenaming(true); }}
        className="chat-session-icon-btn"
        aria-label="Rename conversation"
        title="Rename"
      >
        <SquarePen size={13} style={{ flexShrink: 0 }} />
      </button>
      <button onClick={onDelete} aria-label="Delete conversation" className="chat-session-icon-btn" title="Delete">
        <X size={13} style={{ flexShrink: 0 }} />
      </button>
    </div>
  );
}

export function ChatSidebar({ sessions, activeSessionId, onSelect, onNewChat, onDelete, mobileOpen, onCloseMobile }: Props) {
  const [search, setSearch] = useState('');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    setPinnedIds(readPinnedIds());
    setTitles(readSessionTitles());
  }, []);

  const displayTitle = (s: SessionSummary) => titles[s.sessionId] ?? s.title ?? 'New conversation';

  const filtered = sessions.filter(s => !search.trim() || displayTitle(s).toLowerCase().includes(search.trim().toLowerCase()));
  const pinned = filtered.filter(s => pinnedIds.includes(s.sessionId));
  const recent = filtered.filter(s => !pinnedIds.includes(s.sessionId));

  const handleTogglePin = (sessionId: string) => setPinnedIds(togglePinned(sessionId));
  const handleRename = (sessionId: string, title: string) => setTitles(setSessionTitle(sessionId, title));

  const renderRow = (s: SessionSummary) => (
    <SessionRow
      key={s.sessionId}
      session={s}
      isActive={s.sessionId === activeSessionId}
      isPinned={pinnedIds.includes(s.sessionId)}
      displayTitle={displayTitle(s)}
      onSelect={() => onSelect(s.sessionId)}
      onDelete={() => onDelete(s.sessionId)}
      onTogglePin={() => handleTogglePin(s.sessionId)}
      onRename={(title) => handleRename(s.sessionId, title)}
    />
  );

  return (
    <div
      className="card-editorial chat-sidebar"
      data-mobile-open={mobileOpen}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '270px',
        flexShrink: 0,
        padding: '20px',
      }}
    >
      {onCloseMobile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Conversations</span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="chat-session-icon-btn"
            aria-label="Close conversation menu"
          >
            <X size={18} style={{ flexShrink: 0 }} />
          </button>
        </div>
      )}

      <button
        onClick={onNewChat}
        className="btn-editorial-primary"
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px 16px',
          fontSize: '14px',
        }}
      >
        <Plus size={16} style={{ flexShrink: 0 }} /> New Chat
      </button>

      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 2, flexShrink: 0 }}
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search conversations..."
          className="input-editorial"
          style={{ paddingLeft: '34px', fontSize: '13px', padding: '8px 12px 8px 34px' }}
          aria-label="Search conversations"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', maxHeight: '420px', flex: 1 }}>
        {sessions.length === 0 && (
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '8px 4px' }}>No conversations yet.</span>
        )}
        {sessions.length > 0 && filtered.length === 0 && (
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '8px 4px' }}>No conversations match &quot;{search}&quot;.</span>
        )}
        {pinned.length > 0 && (
          <>
            <span className="chat-sidebar-group-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Pin size={12} style={{ flexShrink: 0 }} aria-hidden="true" /> Pinned
            </span>
            {pinned.map(renderRow)}
          </>
        )}
        {recent.length > 0 && (
          <>
            <span className="chat-sidebar-group-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <History size={12} style={{ flexShrink: 0 }} aria-hidden="true" /> Recent
            </span>
            {recent.map(renderRow)}
          </>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span className="chat-sidebar-group-label" style={{ padding: '0 4px 4px' }}>Quick Links</span>
        {QUICK_NAV.map(item => (
          <Link key={item.href} href={item.href} className="chat-session-title-btn" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', fontSize: '13px' }}>
            <item.icon size={14} aria-hidden="true" style={{ color: 'var(--accent-blue)', flexShrink: 0 }} /> {item.label}
          </Link>
        ))}
        <Link href="/profile/memory-privacy" className="chat-session-title-btn" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', fontSize: '13px' }}>
          <Settings size={14} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> Settings &amp; Memory
        </Link>
      </div>
    </div>
  );
}
