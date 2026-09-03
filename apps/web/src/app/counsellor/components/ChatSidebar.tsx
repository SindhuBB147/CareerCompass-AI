'use client';
import type { SessionSummary } from '../../../hooks/useAiCounsellorChat';

interface Props {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onDelete: (sessionId: string) => void;
}

export function ChatSidebar({ sessions, activeSessionId, onSelect, onNewChat, onDelete }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '260px', flexShrink: 0 }}>
      <button onClick={onNewChat} className="btn-editorial-primary" style={{ width: '100%' }}>
        + New Chat
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '520px' }}>
        {sessions.length === 0 && (
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '8px 4px' }}>No conversations yet.</span>
        )}
        {sessions.map(s => (
          <div
            key={s.sessionId}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', borderRadius: '12px',
              cursor: 'pointer', backgroundColor: s.sessionId === activeSessionId ? 'var(--bg-surface)' : 'transparent',
              border: s.sessionId === activeSessionId ? '1px solid var(--border-color)' : '1px solid transparent',
            }}
          >
            <button
              onClick={() => onSelect(s.sessionId)}
              style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {s.title || 'New conversation'}
            </button>
            <button
              onClick={() => onDelete(s.sessionId)}
              aria-label="Delete conversation"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px' }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
