'use client';
import { BarChart3, Calendar, FileText, TrendingUp, Wallet } from 'lucide-react';
import type { Citation } from '../../../hooks/useAiCounsellorChat';

const SOURCE_META: Record<string, { label: string; icon: typeof BarChart3 }> = {
  prediction: { label: 'Admission Prediction', icon: BarChart3 },
  financial: { label: 'Cost Estimate', icon: Wallet },
  roadmap: { label: 'Career Roadmap', icon: TrendingUp },
  cutoff: { label: 'Cutoff Trend', icon: Calendar },
  exam: { label: 'Exam Info', icon: FileText },
  document: { label: 'Knowledge Document', icon: FileText },
};

/**
 * Lighter "Track B" structured card for reference types with no dedicated
 * by-id API to hydrate from (prediction/financial/roadmap/cutoff/exam/
 * document) — built entirely from data already present on the citation,
 * no extra network call. College/scholarship citations get the richer,
 * live-fetched CollegeResultCard/ScholarshipResultCard instead.
 */
export function StructuredCitationCard({ citation }: { citation: Citation }) {
  const meta = SOURCE_META[citation.sourceType];
  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <div className="card-editorial chat-result-card chat-citation-card">
      <span className="chat-citation-eyebrow">
        <Icon size={13} aria-hidden="true" /> {meta.label}
      </span>
      <strong style={{ fontSize: '14px' }}>{citation.title}</strong>
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{citation.snippet}</span>
    </div>
  );
}
