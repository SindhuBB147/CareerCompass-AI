'use client';
import { useCallback, useRef, useState } from 'react';
import { apiClient, ApiError } from '../lib/api-client';

export interface Citation {
  tag: string;
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
  // Only ever set for sourceType 'document' chunks drawn from a PDF with
  // page markers — omitted (never guessed) for formats with no page
  // concept, or when a chunk spans more than one page (pageRange instead).
  page?: number | null;
  pageRange?: string | null;
}

export interface ActionButtonSpec {
  label: string;
  action: string;
  params: Record<string, string>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  intent?: string;
  confidenceScore?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  lowConfidence?: boolean;
  sourcesCited: Citation[];
  suggestedQuestions: string[];
  relatedColleges: string[];
  actionButtons: ActionButtonSpec[];
  provider?: string;
  streaming?: boolean;
}

export interface SessionSummary {
  sessionId: string;
  title?: string;
  status: string;
  lastMessageAt?: string;
  startedAt: string;
}

/**
 * Both the non-streaming `POST /messages` response and the streaming
 * endpoint's final `event: done` frame are already camelCase by the time
 * they reach the frontend — Nest normalizes the streaming frame server-side
 * (see AiServiceClient.streamQuery) before forwarding it, so there's a
 * single response shape to handle here instead of two.
 */
function normalizeAssistantMessage(raw: any): ChatMessage {
  return {
    role: 'assistant',
    content: raw.content,
    reasoning: raw.reasoning,
    intent: raw.intent,
    confidenceScore: raw.confidenceScore,
    confidenceLevel: raw.confidenceLevel,
    lowConfidence: raw.lowConfidence,
    sourcesCited: raw.sourcesCited ?? [],
    suggestedQuestions: raw.suggestedQuestions ?? [],
    relatedColleges: raw.relatedColleges ?? [],
    actionButtons: raw.actionButtons ?? [],
    provider: raw.provider,
  };
}

export function useAiCounsellorChat(token: string | null) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiClient.get<{ sessions: SessionSummary[] }>('/ai-counsellor/sessions', token);
      setSessions(data.sessions);
    } catch {
      // Session history is a nice-to-have — a failure here shouldn't block the chat itself.
    }
  }, [token]);

  const loadSession = useCallback(async (sid: string) => {
    if (!token) return;
    setError(null);
    try {
      const conv = await apiClient.get<{ messages: any[] }>(`/ai-counsellor/sessions/${sid}`, token);
      setSessionId(sid);
      setMessages(
        conv.messages.map(m =>
          m.role === 'user'
            ? { role: 'user', content: m.content, sourcesCited: [], suggestedQuestions: [], relatedColleges: [], actionButtons: [] }
            : normalizeAssistantMessage(m),
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this conversation.');
    }
  }, [token]);

  const startNewSession = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setError(null);
  }, []);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId;
    const session = await apiClient.post<{ sessionId: string }>('/ai-counsellor/sessions', {}, token);
    setSessionId(session.sessionId);
    return session.sessionId;
  }, [sessionId, token]);

  const sendMessage = useCallback(async (content: string) => {
    if (!token || !content.trim() || loading) return;
    setError(null);
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content, sourcesCited: [], suggestedQuestions: [], relatedColleges: [], actionButtons: [] }]);

    try {
      const sid = await ensureSession();
      setMessages(prev => [...prev, { role: 'assistant', content: '', sourcesCited: [], suggestedQuestions: [], relatedColleges: [], actionButtons: [], streaming: true }]);

      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`/api/v1/ai-counsellor/sessions/${sid}/messages/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new ApiError(`Streaming request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let frameEnd = buffer.indexOf('\n\n');
        while (frameEnd !== -1) {
          const frame = buffer.slice(0, frameEnd);
          buffer = buffer.slice(frameEnd + 2);

          if (frame.startsWith('event: done')) {
            const dataLine = frame.split('\n').find(l => l.startsWith('data:'));
            if (dataLine) {
              const finalPayload = JSON.parse(dataLine.slice(5).trim());
              const finalMsg = normalizeAssistantMessage(finalPayload);
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = finalMsg;
                return next;
              });
            }
          } else if (frame.startsWith('data:')) {
            const payload = JSON.parse(frame.slice(5).trim());
            if (payload.delta) {
              accumulatedText += payload.delta;
              const textSoFar = accumulatedText;
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) next[next.length - 1] = { ...last, content: textSoFar };
                return next;
              });
            }
          }

          frameEnd = buffer.indexOf('\n\n');
        }
      }

      loadSessions();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User-initiated Stop — keep whatever partial answer streamed in so
        // far, just drop the "still streaming" flag, rather than treating
        // a deliberate cancel as an error.
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.streaming) next[next.length - 1] = { ...last, streaming: false };
          return next;
        });
      } else {
        setMessages(prev => prev.filter(m => !m.streaming));
        setError(err instanceof ApiError ? err.message : 'The AI Counsellor is temporarily unavailable. Please try again.');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [token, loading, ensureSession, loadSessions]);

  /** Aborts an in-flight streaming request — the AbortController is created
   * fresh per sendMessage() call above; this just exposes cancelling it. */
  const stopGenerating = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const deleteSession = useCallback(async (sid: string) => {
    if (!token) return;
    await apiClient.del(`/ai-counsellor/sessions/${sid}`, token);
    setSessions(prev => prev.filter(s => s.sessionId !== sid));
    if (sid === sessionId) startNewSession();
  }, [token, sessionId, startNewSession]);

  const submitFeedback = useCallback(async (messageIndex: number, rating: 'up' | 'down', comment?: string) => {
    if (!token || !sessionId) return;
    try {
      await apiClient.post('/ai-counsellor/feedback', { sessionId, messageIndex, rating, comment }, token);
    } catch {
      // Feedback is best-effort; don't surface an error toast for it.
    }
  }, [token, sessionId]);

  return {
    sessions, sessionId, messages, loading, error,
    loadSessions, loadSession, startNewSession, sendMessage, deleteSession, submitFeedback, stopGenerating,
  };
}
