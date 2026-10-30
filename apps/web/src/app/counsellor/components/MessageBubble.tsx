'use client';

import { Sparkles, User } from 'lucide-react';
import { renderMarkdown } from '../../../lib/markdown';
import type { ChatMessage } from '../../../hooks/useAiCounsellorChat';
import { CitationCard } from './CitationCard';
import { SuggestedQuestions } from './SuggestedQuestions';
import { QuickActions } from './QuickActions';
import { MessageActions } from './MessageActions';
import { TypingIndicator } from './TypingIndicator';
import { CollegeResultCard } from './CollegeResultCard';
import { ScholarshipResultCard } from './ScholarshipResultCard';
import { StructuredCitationCard } from './StructuredCitationCard';

const STRUCTURED_CARD_TYPES = ['prediction', 'financial', 'roadmap', 'cutoff', 'document', 'exam'];

interface Props {
  message: ChatMessage;
  index: number;
  sessionId: string | null;
  onPickSuggestion: (q: string) => void;
  onFeedback: (index: number, rating: 'up' | 'down', comment?: string) => void;
  onRegenerate: (index: number) => void;
}

export function MessageBubble({ message, index, sessionId, onPickSuggestion, onFeedback, onRegenerate }: Props) {
  const isUser = message.role === 'user';

  const collegeCitations = isUser ? [] : message.sourcesCited.filter(c => c.sourceType === 'college').slice(0, 2);
  const scholarshipCitations = isUser ? [] : message.sourcesCited.filter(c => c.sourceType === 'scholarship').slice(0, 2);
  const structuredCitations = isUser ? [] : message.sourcesCited.filter(c => STRUCTURED_CARD_TYPES.includes(c.sourceType)).slice(0, 2);

  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        alignItems: 'flex-start',
        width: '100%',
      }}
    >
      {!isUser && (
        <div
          className="chat-avatar-mark"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            flexShrink: 0,
            backgroundColor: 'var(--accent-blue)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '2px',
          }}
          aria-hidden="true"
        >
          <Sparkles size={16} style={{ flexShrink: 0 }} />
        </div>
      )}

      <div
        className={isUser ? 'chat-message-user' : 'card-editorial chat-message-assistant'}
        data-role={isUser ? 'user' : 'assistant'}
        style={{
          maxWidth: isUser ? '75%' : '85%',
          padding: isUser ? '14px 18px' : '20px 24px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px',
          backgroundColor: isUser ? 'var(--text-primary)' : 'var(--card-bg, #ffffff)',
          color: isUser ? '#FFFFFF' : 'var(--text-primary)',
          border: isUser ? 'none' : '1px solid var(--border-color)',
          boxShadow: isUser ? '0 2px 8px rgba(0,0,0,0.06)' : '0 2px 12px rgba(0,0,0,0.03)',
        }}
      >
        {!isUser && message.confidenceLevel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span className="chat-confidence-badge" data-level={message.confidenceLevel}>
              {message.confidenceLevel} confidence
            </span>
            {message.intent && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                · {message.intent.replace('_', ' ')}
              </span>
            )}
          </div>
        )}

        {message.streaming && !message.content ? (
          <TypingIndicator />
        ) : (
          <div
            className="chat-markdown"
            style={{
              fontSize: '15px',
              lineHeight: 1.6,
              color: isUser ? '#FFFFFF' : 'var(--text-primary)',
            }}
          >
            {renderMarkdown(message.content)}
          </div>
        )}

        {message.streaming && message.content && (
          <div style={{ marginTop: '10px' }}>
            <TypingIndicator statusIndex={3} />
          </div>
        )}

        {!isUser && !message.streaming && message.reasoning && (
          <details style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Reasoning</summary>
            <div style={{ marginTop: '6px', lineHeight: 1.5 }}>{message.reasoning}</div>
          </details>
        )}

        {!isUser && !message.streaming && collegeCitations.map(c => <CollegeResultCard key={c.sourceId} collegeId={c.sourceId} />)}
        {!isUser && !message.streaming && scholarshipCitations.map(c => <ScholarshipResultCard key={c.sourceId} scholarshipId={c.sourceId} />)}
        {!isUser && !message.streaming && structuredCitations.map(c => <StructuredCitationCard key={c.sourceId} citation={c} />)}

        {!isUser && !message.streaming && <CitationCard citations={message.sourcesCited} />}

        {!isUser && !message.streaming && (
          <SuggestedQuestions questions={message.suggestedQuestions} onPick={onPickSuggestion} />
        )}
        {!isUser && !message.streaming && <QuickActions actions={message.actionButtons} />}

        {!isUser && !message.streaming && (
          <MessageActions
            message={message}
            index={index}
            sessionId={sessionId}
            onFeedback={onFeedback}
            onRegenerate={onRegenerate}
          />
        )}
      </div>

      {isUser && (
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            flexShrink: 0,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '2px',
          }}
          aria-hidden="true"
        >
          <User size={16} style={{ flexShrink: 0 }} />
        </div>
      )}
    </div>
  );
}
