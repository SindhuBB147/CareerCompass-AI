'use client';
import { useState } from 'react';
import { Bookmark, Check, Copy, Download, Flag, RotateCcw, Share2, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ChatMessage } from '../../../hooks/useAiCounsellorChat';
import { downloadMarkdown } from '../../../lib/chat-export';
import { isBookmarked as readIsBookmarked, toggleBookmark } from '../../../lib/counsellor-storage';

const REPORT_REASONS = ['Inaccurate information', 'Not helpful', 'Inappropriate', 'Other'];

interface Props {
  message: ChatMessage;
  index: number;
  sessionId: string | null;
  onFeedback: (index: number, rating: 'up' | 'down', comment?: string) => void;
  onRegenerate: (index: number) => void;
}

export function MessageActions({ message, index, sessionId, onFeedback, onRegenerate }: Props) {
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(() => (sessionId ? readIsBookmarked(sessionId, index) : false));
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);

  const handleFeedback = (rating: 'up' | 'down') => {
    setFeedbackGiven(rating);
    onFeedback(index, rating);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser; the button simply won't confirm.
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'CareerCompass AI Counsellor', text: message.content });
        return;
      } catch {
        // User cancelled the share sheet, or it's unsupported for this content — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Nothing more we can do without a backend share link.
    }
  };

  const handleDownload = () => {
    downloadMarkdown('counsellor-response.md', message.content);
  };

  const handleBookmark = () => {
    if (!sessionId) return;
    const ids = toggleBookmark(sessionId, index);
    setBookmarked(ids.includes(`${sessionId}:${index}`));
  };

  const handleReport = (reason: string) => {
    onFeedback(index, 'down', `[Reported: ${reason}]`);
    setFeedbackGiven('down');
    setReported(true);
    setReportOpen(false);
  };

  return (
    <div className="chat-message-actions">
      <button
        type="button"
        onClick={() => handleFeedback('up')}
        disabled={feedbackGiven !== null}
        className="chat-action-btn"
        data-active={feedbackGiven === 'up'}
        aria-disabled={feedbackGiven !== null}
        aria-label="Helpful"
        title="Helpful"
      >
        <ThumbsUp size={14} fill={feedbackGiven === 'up' ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        onClick={() => handleFeedback('down')}
        disabled={feedbackGiven !== null}
        className="chat-action-btn"
        data-active={feedbackGiven === 'down' && !reported}
        aria-disabled={feedbackGiven !== null}
        aria-label="Not helpful"
        title="Not helpful"
      >
        <ThumbsDown size={14} fill={feedbackGiven === 'down' && !reported ? 'currentColor' : 'none'} />
      </button>

      <button type="button" onClick={handleCopy} className="chat-action-btn" aria-label="Copy response" title="Copy">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>

      <button type="button" onClick={handleShare} className="chat-action-btn" aria-label="Share response" title="Share">
        <Share2 size={14} />
      </button>

      <button type="button" onClick={handleDownload} className="chat-action-btn" aria-label="Download response as Markdown" title="Download">
        <Download size={14} />
      </button>

      <button
        type="button"
        onClick={handleBookmark}
        className="chat-action-btn"
        data-active={bookmarked}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this response'}
        title={bookmarked ? 'Bookmarked' : 'Bookmark'}
      >
        <Bookmark size={14} fill={bookmarked ? 'currentColor' : 'none'} />
      </button>

      <button
        type="button"
        onClick={() => onRegenerate(index)}
        className="chat-action-btn"
        aria-label="Regenerate response"
        title="Regenerate"
      >
        <RotateCcw size={14} />
      </button>

      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setReportOpen(v => !v)}
          disabled={reported}
          className="chat-action-btn"
          data-active={reported}
          aria-disabled={reported}
          aria-expanded={reportOpen}
          aria-label={reported ? 'Reported' : 'Report response'}
          title={reported ? 'Reported' : 'Report'}
        >
          <Flag size={14} fill={reported ? 'currentColor' : 'none'} />
        </button>
        {reportOpen && (
          <div
            style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 5, minWidth: '180px',
              backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.1)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px',
            }}
          >
            {REPORT_REASONS.map(reason => (
              <button
                key={reason}
                type="button"
                onClick={() => handleReport(reason)}
                style={{ background: 'none', border: 'none', textAlign: 'left', padding: '6px 8px', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '6px' }}
              >
                {reason}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
