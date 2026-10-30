'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Pin } from 'lucide-react';
import type { Citation } from '../../../hooks/useAiCounsellorChat';

const SOURCE_LABELS: Record<string, string> = {
  college: 'College record',
  cutoff: 'Cutoff data',
  scholarship: 'Scholarship',
  prediction: 'Admission prediction',
  financial: 'Cost estimate',
  roadmap: 'Career roadmap',
  exam: 'Exam info',
  document: 'Knowledge document',
};

export function CitationCard({ citations }: { citations: Citation[] }) {
  const [expanded, setExpanded] = useState(false);
  if (citations.length === 0) return null;

  return (
    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}
      >
        <Pin size={12} aria-hidden="true" style={{ flexShrink: 0 }} /> {citations.length} verified source{citations.length > 1 ? 's' : ''} {expanded ? <ChevronUp size={12} style={{ flexShrink: 0 }} /> : <ChevronDown size={12} style={{ flexShrink: 0 }} />}
      </button>
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {citations.map(c => (
            <div key={c.tag} style={{ fontSize: '13px', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <strong>{c.title}</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  [{c.tag}] {SOURCE_LABELS[c.sourceType] ?? c.sourceType}
                  {c.page ? ` · p. ${c.page}` : c.pageRange ? ` · pp. ${c.pageRange}` : ''}
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{c.snippet}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
