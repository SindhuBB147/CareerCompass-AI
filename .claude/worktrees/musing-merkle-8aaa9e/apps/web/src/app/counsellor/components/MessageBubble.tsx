'use client';
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

const STRUCTURED_CARD_TYPES = ['prediction', 'financial', 'roadmap', 'cutoff'];

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
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div className="chat-message-bubble" data-role={isUser ? 'user' : 'assistant'} style={{ maxWidth: '78%' }}>
        {!isUser && message.confidenceLevel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span className="chat-confidence-badge" data-level={message.confidenceLevel}>
              {message.confidenceLevel} confidence
            </span>
            {message.intent && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· {message.intent.replace('_', ' ')}</span>}
          </div>
        )}

        {message.streaming && !message.content ? (
          <TypingIndicator />
        ) : (
          <div style={{ fontSize: '16px', lineHeight: 1.6 }} className="chat-markdown">
            {renderMarkdown(message.content)}
          </div>
        )}

        {message.streaming && message.content && (
          <div style={{ marginTop: '10px' }}><TypingIndicator statusIndex={3} /></div>
        )}

        {!isUser && !message.streaming && message.reasoning && (
          <details style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Reasoning</summary>
            <div style={{ marginTop: '6px' }}>{message.reasoning}</div>
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
    </div>
  );
}
