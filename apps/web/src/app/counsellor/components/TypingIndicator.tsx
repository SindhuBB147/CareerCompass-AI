'use client';

const STATUS_LABELS = ['Thinking', 'Searching knowledge base', 'Retrieving verified data', 'Generating response'];

export function TypingIndicator({ statusIndex = 0 }: { statusIndex?: number }) {
  const label = STATUS_LABELS[Math.min(statusIndex, STATUS_LABELS.length - 1)];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div className="chat-typing" role="status" aria-label={label}>
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
      </div>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}…</span>
    </div>
  );
}
