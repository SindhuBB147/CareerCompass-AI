'use client';

import { useEffect, useState } from 'react';
import { searchApi, type SummarizeResponse } from '../../../lib/search-api';
import { renderMarkdown } from '../../../lib/markdown';

const SOURCE_LABELS: Record<string, string> = {
  college: 'College record', cutoff: 'Cutoff data', scholarship: 'Scholarship',
  prediction: 'Admission prediction', financial: 'Cost estimate', roadmap: 'Career roadmap',
  exam: 'Exam info', document: 'Knowledge document',
};

interface Props {
  token: string;
  query: string;
  onPickFollowUp: (question: string) => void;
}

/**
 * Loads asynchronously, deliberately separate from the structured
 * college/scholarship results (which render immediately) — /search/summarize
 * calls the existing /rag/query pipeline, which always invokes an LLM (real
 * latency), so it must never block the primary results. See
 * search.service.ts's summarize().
 */
export function AiResponsePanel({ token, query, onPickFollowUp }: Props) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<SummarizeResponse | null>(null);
  const [expandedCitations, setExpandedCitations] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setData(null);
    searchApi.summarize(token, query)
      .then((res) => { if (!cancelled) { setData(res); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [token, query]);

  if (state === 'loading') {
    return (
      <div className="card-editorial smart-search-ai-panel smart-search-ai-panel-loading" aria-busy="true">
        <span className="smart-search-ai-badge">✨ AI is analyzing your results…</span>
      </div>
    );
  }

  if (state === 'error' || !data) {
    return (
      <div className="card-editorial smart-search-ai-panel smart-search-ai-panel-error">
        <span className="smart-search-ai-badge">✨ AI Summary</span>
        <p className="text-body" style={{ marginTop: '8px' }}>
          The AI summary is temporarily unavailable — the results below are still fully accurate, they just don&apos;t have a written explanation right now.
        </p>
      </div>
    );
  }

  return (
    <div className="card-editorial smart-search-ai-panel">
      <div className="smart-search-ai-header">
        <span className="smart-search-ai-badge">✨ AI Summary</span>
        {data.lowConfidence && <span className="colleges-badge-editorial-sm">Low confidence — verify details</span>}
      </div>

      <div className="text-body smart-search-ai-summary">{renderMarkdown(data.summary)}</div>

      {data.reasoning && (
        <details className="smart-search-ai-reasoning">
          <summary>Why these results?</summary>
          <p className="text-body">{data.reasoning}</p>
        </details>
      )}

      {data.citations.length > 0 && (
        <div className="smart-search-ai-citations">
          <button type="button" className="smart-search-citations-toggle" onClick={() => setExpandedCitations((v) => !v)}>
            📌 {data.citations.length} verified source{data.citations.length > 1 ? 's' : ''} {expandedCitations ? '▲' : '▼'}
          </button>
          {expandedCitations && (
            <div className="smart-search-citations-list">
              {data.citations.map((c) => (
                <div key={c.tag} className="smart-search-citation">
                  <div className="smart-search-citation-head">
                    <strong>{c.title}</strong>
                    <span>[{c.tag}] {SOURCE_LABELS[c.source_type] ?? c.source_type}</span>
                  </div>
                  <div className="smart-search-citation-snippet">{c.snippet}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {data.suggestedQuestions.length > 0 && (
        <div className="smart-search-followups">
          <span className="smart-search-followups-label">Related questions</span>
          <div className="colleges-search-chips">
            {data.suggestedQuestions.map((q) => (
              <button key={q} type="button" className="colleges-search-chip" onClick={() => onPickFollowUp(q)}>{q}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
