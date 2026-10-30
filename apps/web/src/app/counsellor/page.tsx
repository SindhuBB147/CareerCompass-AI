'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Menu, Plus, Settings } from 'lucide-react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useAiCounsellorChat } from '../../hooks/useAiCounsellorChat';
import { useSessionState } from '../../hooks/useSessionState';
import { ReportDownloadButton } from '../../components/ui/ReportDownloadButton';
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

  // Session Persistence — resume the last AI Counsellor session on return
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
        <div className="card-editorial" style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: '36px', marginBottom: '16px' }}>🤖</div>
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
    <div className="counsellor-page section-padding container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '32px', minHeight: 'calc(100vh - 160px)' }}>
      {/* Page Editorial Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>
              AI RAG Counselling &amp; Guidance
            </span>
            <h1 className="text-section-title font-serif" style={{ margin: 0 }}>CareerCompass AI Counsellor</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ReportDownloadButton
              reportType="ai_recommendation"
              tooltip="Download Conversation PDF"
              size="md"
            />
            <button
              type="button"
              onClick={startNewSession}
              className="btn-editorial-secondary"
              style={{ padding: '8px 16px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} style={{ flexShrink: 0 }} /> <span className="chat-header-new-chat-label">New Chat</span>
            </button>
            <Link href="/profile/memory-privacy" className="chat-action-btn" aria-label="AI Counsellor settings and memory controls" title="Settings & memory" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={16} style={{ flexShrink: 0 }} />
            </Link>
          </div>
        </div>

        <p className="text-body" style={{ maxWidth: '720px' }}>
          Personalized higher education and career guidance grounded in KEA cutoffs, placement analytics, financial data, and your student profile.
        </p>
      </div>

      {/* Sticky Bar / Identity Status Bar */}
      <div className="chat-header">
        <div className="chat-header-identity">
          <button
            type="button"
            className="chat-hamburger"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open conversation list"
            aria-expanded={mobileSidebarOpen}
          >
            <Menu size={18} style={{ flexShrink: 0 }} />
          </button>
          <div className="chat-avatar-mark" style={{ backgroundColor: 'var(--accent-blue)', borderRadius: '10px' }} aria-hidden="true">
            <Sparkles size={18} style={{ flexShrink: 0 }} />
          </div>
          <div className="chat-header-text">
            <span className="chat-header-title font-serif">Active Session</span>
            <span className="chat-header-status">
              <span className="chat-status-dot" aria-hidden="true" />
              Online
              <span className="chat-header-status-detail">
                {latestProvider ? ` · ${PROVIDER_LABELS[latestProvider] ?? latestProvider}` : ''} · Knowledge base ready
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Chat Layout */}
      <div className="counsellor-layout" style={{ display: 'flex', gap: '28px', flex: 1, position: 'relative', alignItems: 'stretch' }}>
        <ChatSidebar
          sessions={sessions}
          activeSessionId={sessionId}
          onSelect={(id) => { loadSession(id); setMobileSidebarOpen(false); }}
          onNewChat={() => { startNewSession(); setMobileSidebarOpen(false); }}
          onDelete={deleteSession}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        {mobileSidebarOpen && (
          <div
            className="chat-sidebar-backdrop"
            data-visible="true"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <div className="card-editorial" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px', gap: '20px', minHeight: '580px', minWidth: 0 }}>
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation with the AI Counsellor"
            style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingRight: '8px' }}
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
            {error && (
              <div role="alert" style={{ color: '#B3261E', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '12px', padding: '12px 16px', fontSize: '14px' }}>
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <ChatInput onSend={sendMessage} disabled={loading} onStop={stopGenerating} />
        </div>
      </div>
    </div>
  );
}
