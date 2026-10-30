'use client';
import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { apiClient, ApiError } from '../../../lib/api-client';

interface FlaggedMessage {
  role: 'user' | 'assistant';
  content: string;
  confidenceLevel?: string;
  confidenceScore?: number;
  intent?: string;
  sourcesCited?: Array<{ tag: string; sourceType: string; title: string; snippet: string }>;
  timestamp: string;
}

interface FlaggedSession {
  sessionId: string;
  userId: string;
  title?: string;
  status: string;
  flaggedForReview: boolean;
  lastMessageAt?: string;
  messages: FlaggedMessage[];
}

export default function AiReviewPage() {
  const { adminToken } = useAdminAuth();
  const [sessions, setSessions] = useState<FlaggedSession[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminToken) return;
    setLoading(true);
    apiClient.get<{ sessions: FlaggedSession[] }>('/admin/ai-counsellor/flagged', adminToken)
      .then(data => setSessions(data.sessions))
      .catch(err => setError(err instanceof ApiError ? err.message : 'Failed to load flagged conversations.'))
      .finally(() => setLoading(false));
  }, [adminToken]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">AI Conversation Review</h1>
          <p className="admin-page-subtitle">Conversations the AI Counsellor flagged as low-confidence — review for knowledge-base gaps or prompt issues.</p>
        </div>
      </div>

      {error && <div className="admin-inline-message" data-tone="error">{error}</div>}
      {loading && <p className="admin-loading">Loading…</p>}
      {!loading && sessions.length === 0 && !error && (
        <div className="card-editorial admin-empty-state">
          <div className="admin-empty-icon">✅</div>
          <p style={{ margin: 0 }}>No flagged conversations right now.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sessions.map(session => {
          const lastAssistant = [...session.messages].reverse().find(m => m.role === 'assistant');
          const isOpen = expanded === session.sessionId;
          return (
            <div key={session.sessionId} className="card-editorial">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : session.sessionId)}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{session.title || session.sessionId}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    User {session.userId} · {session.messages.length} messages
                    {lastAssistant?.confidenceLevel && ` · ${lastAssistant.confidenceLevel} confidence`}
                  </div>
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {isOpen && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  {session.messages.map((m, idx) => (
                    <div key={idx} style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-main)', fontSize: '13px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase' }}>
                        {m.role} {m.confidenceLevel && `· ${m.confidenceLevel} (${m.confidenceScore?.toFixed(2)})`} {m.intent && `· ${m.intent}`}
                      </div>
                      <div>{m.content}</div>
                      {m.sourcesCited && m.sourcesCited.length > 0 && (
                        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--accent-blue)' }}>
                          Sources: {m.sourcesCited.map(s => s.title).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
