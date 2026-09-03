'use client';
import { useState } from 'react';
import { renderMarkdown } from '../../../lib/markdown';
import type { ChatMessage } from '../../../hooks/useAiCounsellorChat';
import { CitationCard } from './CitationCard';
import { SuggestedQuestions } from './SuggestedQuestions';
import { QuickActions } from './QuickActions';

const CONFIDENCE_COLORS: Record<string, string> = {
  high: '#2E7D46',
  medium: '#B8860B',
  low: '#B3261E',
};

interface Props {
  message: ChatMessage;
  index: number;
  onPickSuggestion: (q: string) => void;
  onFeedback: (index: number, rating: 'up' | 'down') => void;
}

export function MessageBubble({ message, index, onPickSuggestion, onFeedback }: Props) {
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);
  const isUser = message.role === 'user';

  const handleFeedback = (rating: 'up' | 'down') => {
    setFeedbackGiven(rating);
    onFeedback(index, rating);
  };

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        className="chat-message-bubble"
        style={{
          maxWidth: '78%',
          padding: '20px 24px',
          borderRadius: '20px',
          backgroundColor: isUser ? 'var(--text-primary)' : 'var(--bg-main)',
          border: !isUser ? '1px solid var(--border-color)' : 'none',
          color: isUser ? '#FFFFFF' : 'var(--text-primary)',
        }}
      >
        {!isUser && message.confidenceLevel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span
              style={{
                fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: CONFIDENCE_COLORS[message.confidenceLevel] ?? 'var(--text-muted)',
                border: `1px solid ${CONFIDENCE_COLORS[message.confidenceLevel] ?? 'var(--border-color)'}`,
                borderRadius: '999px', padding: '3px 10px',
              }}
            >
              {message.confidenceLevel} confidence
            </span>
            {message.intent && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· {message.intent.replace('_', ' ')}</span>}
          </div>
        )}

        <div style={{ fontSize: '16px', lineHeight: 1.6 }} className="chat-markdown">
          {message.content ? renderMarkdown(message.content) : (message.streaming ? 'Thinking…' : '')}
        </div>

        {message.streaming && (
          <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--accent-blue)' }}>AI Counsellor is retrieving verified data…</div>
        )}

        {!isUser && !message.streaming && message.reasoning && (
          <details style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Reasoning</summary>
            <div style={{ marginTop: '6px' }}>{message.reasoning}</div>
          </details>
        )}

        {!isUser && !message.streaming && <CitationCard citations={message.sourcesCited} />}

        {!isUser && !message.streaming && (
          <SuggestedQuestions questions={message.suggestedQuestions} onPick={onPickSuggestion} />
        )}
        {!isUser && !message.streaming && <QuickActions actions={message.actionButtons} />}

        {!isUser && !message.streaming && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => handleFeedback('up')}
              disabled={feedbackGiven !== null}
              style={{ background: 'none', border: 'none', cursor: feedbackGiven ? 'default' : 'pointer', opacity: feedbackGiven === 'down' ? 0.4 : 1, fontSize: '14px' }}
              aria-label="Helpful"
            >
              {feedbackGiven === 'up' ? '👍 Thanks' : '👍'}
            </button>
            <button
              onClick={() => handleFeedback('down')}
              disabled={feedbackGiven !== null}
              style={{ background: 'none', border: 'none', cursor: feedbackGiven ? 'default' : 'pointer', opacity: feedbackGiven === 'up' ? 0.4 : 1, fontSize: '14px' }}
              aria-label="Not helpful"
            >
              {feedbackGiven === 'down' ? '👎 Noted' : '👎'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
