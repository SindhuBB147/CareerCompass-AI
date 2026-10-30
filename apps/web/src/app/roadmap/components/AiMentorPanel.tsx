'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { roadmapApi, type RoadmapRecommendations } from '../../../lib/roadmap-api';
import { apiClient } from '../../../lib/api-client';

const QUICK_QUESTIONS = [
  'What should I learn next?',
  'How do I prepare for placements?',
  'What is the best certification for me right now?',
  'Should I focus on DSA or AI?',
];

interface FirstMessage { content: string }

export function AiMentorPanel({ token }: { token: string }) {
  const [recommendations, setRecommendations] = useState<RoadmapRecommendations | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    roadmapApi.getRecommendations(token).then(setRecommendations).catch(() => setRecommendations(null)).finally(() => setLoadingRecs(false));
  }, [token]);

  const ask = async (q: string) => {
    setAsking(true);
    setAskError(null);
    setAnswer(null);
    setQuestion(q);
    try {
      const session = await apiClient.post<{ sessionId: string; firstMessage?: FirstMessage }>('/ai-counsellor/sessions', { initialMessage: q }, token);
      setAnswer(session.firstMessage?.content ?? "I couldn't find a grounded answer for that — try the full AI Counsellor for a deeper conversation.");
    } catch {
      setAskError('Could not reach the AI Mentor right now. Please try again in a moment.');
    } finally {
      setAsking(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h3 className="font-serif" style={{ fontSize: '22px', marginBottom: '6px' }}>Recommended Focus</h3>
        <p className="text-body" style={{ marginBottom: '16px' }}>Based on your incomplete, highest-priority milestones.</p>
        {loadingRecs ? (
          <p className="text-body">Loading recommendations…</p>
        ) : !recommendations ? (
          <p className="text-body">Recommendations will appear once you&apos;ve generated a roadmap.</p>
        ) : (
          <div className="roadmap-card-grid">
            <div className="card-editorial" style={{ padding: '20px' }}>
              <h4 className="font-serif" style={{ fontSize: '16px', marginBottom: '10px' }}>Skills to Improve</h4>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {recommendations.skillsToImprove.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>You&apos;re all caught up!</span> : recommendations.skillsToImprove.map(s => <span key={s} className="roadmap-chip">{s}</span>)}
              </div>
            </div>
            <div className="card-editorial" style={{ padding: '20px' }}>
              <h4 className="font-serif" style={{ fontSize: '16px', marginBottom: '10px' }}>Courses to Learn</h4>
              {recommendations.coursesToLearn.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Nothing pending.</span> : (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px' }}>
                  {recommendations.coursesToLearn.map(c => <li key={c.title}>{c.title} — {c.provider}</li>)}
                </ul>
              )}
            </div>
            <div className="card-editorial" style={{ padding: '20px' }}>
              <h4 className="font-serif" style={{ fontSize: '16px', marginBottom: '10px' }}>Projects to Try</h4>
              {recommendations.projectsToTry.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Nothing pending.</span> : (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px' }}>
                  {recommendations.projectsToTry.map(p => <li key={p.title}>{p.title.split('.')[0]}</li>)}
                </ul>
              )}
            </div>
            <div className="card-editorial" style={{ padding: '20px' }}>
              <h4 className="font-serif" style={{ fontSize: '16px', marginBottom: '10px' }}>Certifications to Target</h4>
              {recommendations.certificationsToTarget.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Nothing pending.</span> : (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px' }}>
                  {recommendations.certificationsToTarget.map(c => <li key={c.name}>{c.name} — {c.provider}</li>)}
                </ul>
              )}
            </div>
            {recommendations.alternativeCareerPaths.length > 0 && (
              <div className="card-editorial" style={{ padding: '20px', gridColumn: '1 / -1' }}>
                <h4 className="font-serif" style={{ fontSize: '16px', marginBottom: '10px' }}>Alternative Career Paths Worth Exploring</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {recommendations.alternativeCareerPaths.map(c => (
                    <div key={c.careerId} style={{ fontSize: '14px' }}><strong>{c.name}</strong> — {c.reason}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-serif" style={{ fontSize: '22px', marginBottom: '6px' }}>Ask Your AI Mentor</h3>
        <p className="text-body" style={{ marginBottom: '16px' }}>Answers are grounded in your roadmap and profile via the AI Counsellor.</p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {QUICK_QUESTIONS.map(q => (
            <button key={q} type="button" className="btn-editorial-secondary roadmap-btn-sm" disabled={asking} onClick={() => ask(q)}>{q}</button>
          ))}
        </div>
        <form
          style={{ display: 'flex', gap: '10px' }}
          onSubmit={e => { e.preventDefault(); if (question.trim()) ask(question.trim()); }}
        >
          <input
            className="input-editorial"
            placeholder="Ask anything about your roadmap..."
            value={question}
            onChange={e => setQuestion(e.target.value)}
          />
          <button type="submit" className="btn-editorial-primary" disabled={asking || !question.trim()}>{asking ? 'Asking…' : 'Ask'}</button>
        </form>

        {askError && <p style={{ color: '#C0392B', marginTop: '12px' }}>{askError}</p>}
        {answer && (
          <div className="card-editorial" style={{ marginTop: '16px', padding: '22px' }}>
            <p className="text-body chat-markdown" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{answer}</p>
            <Link href="/counsellor" style={{ color: 'var(--accent-blue)', fontSize: '14px', marginTop: '12px', display: 'inline-block' }}>Continue this conversation in the full AI Counsellor →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
