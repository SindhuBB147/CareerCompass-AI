'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useAiCounsellorChat } from '../../hooks/useAiCounsellorChat';
import { useSessionState } from '../../hooks/useSessionState';
import { ChatSidebar } from './components/ChatSidebar';
import { MessageBubble } from './components/MessageBubble';
import { ChatInput } from './components/ChatInput';

export default function CounsellorPage() {
  const { accessToken, isAuthenticated, isLoading } = useUserAuth();
  const {
    sessions, sessionId, messages, loading, error,
    loadSessions, loadSession, startNewSession, sendMessage, deleteSession, submitFeedback,
  } = useAiCounsellorChat(accessToken);
  const { state: sessionState, hydrated: sessionStateHydrated, patch: patchSessionState } = useSessionState();

  const scrollRef = useRef<HTMLDivElement>(null);
  const resumedRef = useRef(false);

  useEffect(() => {
    if (accessToken) loadSessions();
  }, [accessToken, loadSessions]);

  // Session Persistence — resume the last AI Counsellor session on return,
  // instead of always starting on an empty chat. Only ever attempted once
  // per page load, and only after both the session list and the remembered
  // session-state have actually loaded.
  useEffect(() => {
    if (resumedRef.current || !sessionStateHydrated || sessionId) return;
    const lastId = sessionState?.lastAiSessionId;
    if (lastId && sessions.some(s => s.sessionId === lastId)) {
      resumedRef.current = true;
      loadSession(lastId);
    }
  }, [sessionStateHydrated, sessionState, sessions, sessionId, loadSession]);

  useEffect(() => {
    if (sessionId) patchSessionState({ lastAiSessionId: sessionId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="section-padding container-editorial">
        <div className="card-editorial" style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
          <h1 className="text-section-title font-serif" style={{ fontSize: '28px', marginBottom: '12px' }}>Sign in for the AI Counsellor</h1>
          <p className="text-body" style={{ marginBottom: '24px' }}>
            The AI Counsellor personalizes every answer using your exam rank, category, and preferences — sign in to get started.
          </p>
          <Link href="/login/student" className="btn-editorial-primary">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="counsellor-page section-padding container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '40px', minHeight: 'calc(100vh - 160px)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '32px' }}>
        <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>
          Grounded AI Counselling
        </span>
        <h1 className="text-section-title font-serif">24/7 AI RAG Counsellor</h1>
        <p className="text-body" style={{ maxWidth: '720px' }}>
          Ask about KCET cutoffs, seat matrix, fee structures, scholarships, career roadmaps, and the counselling process.
          Every response is grounded in the platform's verified data, cites its sources, and shows a confidence level.
        </p>
      </div>

      <div className="counsellor-layout" style={{ display: 'flex', gap: '32px', flex: 1 }}>
        <ChatSidebar
          sessions={sessions}
          activeSessionId={sessionId}
          onSelect={loadSession}
          onNewChat={startNewSession}
          onDelete={deleteSession}
        />

        <div className="card-editorial" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '36px', gap: '24px', minHeight: '560px' }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '8px' }}>
            {messages.length === 0 && (
              <div style={{ padding: '20px 24px', borderRadius: '20px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                Hello! I&apos;m your CareerCompass AI Counsellor, grounded in verified KEA, KCET, COMEDK, and college data.
                How can I help with your admissions journey today?
              </div>
            )}
            {messages.map((msg, idx) => (
              <MessageBubble
                key={idx}
                message={msg}
                index={idx}
                onPickSuggestion={sendMessage}
                onFeedback={submitFeedback}
              />
            ))}
            {error && (
              <div style={{ color: '#B3261E', fontSize: '14px', padding: '8px' }}>{error}</div>
            )}
          </div>

          <ChatInput onSend={sendMessage} disabled={loading} />
        </div>
      </div>
    </div>
  );
}
