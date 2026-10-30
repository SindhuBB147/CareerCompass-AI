'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, Menu, Plus, Settings } from 'lucide-react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useAiCounsellorChat } from '../../hooks/useAiCounsellorChat';
import { useSessionState } from '../../hooks/useSessionState';
import { ChatSidebar } from './components/ChatSidebar';
import { MessageBubble } from './components/MessageBubble';
import { ChatInput } from './components/ChatInput';
import { WelcomeScreen } from './components/WelcomeScreen';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI', azure_openai: 'Azure OpenAI', gemini: 'Gemini', ollama: 'Ollama', fallback: 'Offline mode',
};

export default function CounsellorPage() {
  const { accessToken, isAuthenticated, isLoading } = useUserAuth();
  const {
    sessions, sessionId, messages, loading, error,
    loadSessions, loadSession, startNewSession, sendMessage, deleteSession, submitFeedback, stopGenerating,
  } = useAiCounsellorChat(accessToken);
  const { state: sessionState, hydrated: sessionStateHydrated, patch: patchSessionState } = useSessionState();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const resumedRef = useRef(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [hiddenIndices, setHiddenIndices] = useState<Set<number>>(new Set());

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
    // scrollIntoView finds whichever ancestor actually scrolls — the inner
    // message list if it has its own overflow, or the page itself
    // otherwise (this page scrolls with the rest of the site by design,
    // matching every other page — it isn't a fixed-viewport SPA panel).
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    setHiddenIndices(new Set());
  }, [sessionId]);

  const handleRegenerate = (assistantIndex: number) => {
    const userIndex = assistantIndex - 1;
    const userMessage = messages[userIndex];
    if (!userMessage || userMessage.role !== 'user') return;
    setHiddenIndices(prev => new Set(prev).add(userIndex).add(assistantIndex));
    sendMessage(userMessage.content);
  };

  const latestProvider = [...messages].reverse().find(m => m.role === 'assistant' && m.provider)?.provider;

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
    <div className="counsellor-page section-padding container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '24px', minHeight: 'calc(100vh - 160px)' }}>
      <div className="chat-header">
        <div className="chat-header-identity">
          <button
            type="button"
            className="chat-hamburger"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open conversation list"
            aria-expanded={mobileSidebarOpen}
          >
            <Menu size={18} />
          </button>
          <div className="chat-avatar-mark" aria-hidden="true"><Bot size={20} /></div>
          <div className="chat-header-text">
            <span className="chat-header-title font-serif">CareerCompass AI Counsellor</span>
            <span className="chat-header-status">
              <span className="chat-status-dot" aria-hidden="true" />
              Online
              <span className="chat-header-status-detail">
                {latestProvider ? ` · ${PROVIDER_LABELS[latestProvider] ?? latestProvider}` : ''} · Knowledge base ready
              </span>
            </span>
          </div>
        </div>
        <div className="chat-header-actions">
          <button
            type="button"
            onClick={startNewSession}
            className="btn-editorial-secondary"
            style={{ padding: '8px 16px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> <span className="chat-header-new-chat-label">New Chat</span>
          </button>
          <Link href="/profile/memory-privacy" className="chat-action-btn" aria-label="AI Counsellor settings and memory controls" title="Settings & memory">
            <Settings size={16} />
          </Link>
        </div>
      </div>

      <div className="counsellor-layout" style={{ display: 'flex', gap: '32px', flex: 1, position: 'relative' }}>
        <ChatSidebar
          sessions={sessions}
          activeSessionId={sessionId}
          onSelect={(id) => { loadSession(id); setMobileSidebarOpen(false); }}
          onNewChat={() => { startNewSession(); setMobileSidebarOpen(false); }}
          onDelete={deleteSession}
          mobileOpen={mobileSidebarOpen}
        />
        {mobileSidebarOpen && (
          <div
            className="chat-sidebar-backdrop"
            data-visible="true"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <div className="card-editorial" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '36px', gap: '24px', minHeight: '560px', minWidth: 0 }}>
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation with the AI Counsellor"
            style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '8px' }}
          >
            {messages.length === 0 ? (
              <WelcomeScreen onPick={sendMessage} />
            ) : (
              messages.map((msg, idx) => (
                hiddenIndices.has(idx) ? null : (
                  <MessageBubble
                    key={idx}
                    message={msg}
                    index={idx}
                    sessionId={sessionId}
                    onPickSuggestion={sendMessage}
                    onFeedback={submitFeedback}
                    onRegenerate={handleRegenerate}
                  />
                )
              ))
            )}
            {error && <div role="alert" style={{ color: '#B3261E', fontSize: '14px', padding: '8px' }}>{error}</div>}
            <div ref={bottomRef} />
          </div>

          <ChatInput onSend={sendMessage} disabled={loading} onStop={stopGenerating} />
        </div>
      </div>
    </div>
  );
}
