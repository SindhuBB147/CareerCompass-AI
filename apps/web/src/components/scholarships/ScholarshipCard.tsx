'use client';

import Link from 'next/link';
import type { Scholarship, RecommendationTier } from '../../lib/scholarships-api';
import { formatAward } from '../../lib/scholarship-format';
import { DeadlineChip } from './DeadlineChip';
import { TierBadge } from './TierBadge';

const PROVIDER_LABELS: Record<string, string> = {
  government: 'Government',
  private: 'Private',
  institution: 'Institution',
};

export function ScholarshipCard({
  scholarship,
  tier,
  tierLabel,
  isBookmarked,
  onToggleBookmark,
}: {
  scholarship: Scholarship;
  tier?: RecommendationTier;
  tierLabel?: string;
  isBookmarked?: boolean;
  onToggleBookmark?: (scholarship: Scholarship) => void;
}) {
  const id = scholarship.slug || scholarship.id || scholarship._id;

  return (
    <div className="card-editorial scholarship-card">
      <div className="scholarship-card-top">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          <div className="scholarship-card-badges">
            <span className="badge-editorial">{PROVIDER_LABELS[scholarship.provider] ?? scholarship.provider}</span>
            {scholarship.featured && <span className="colleges-badge colleges-badge-dark">Featured</span>}
            {tier && tierLabel && <TierBadge tier={tier} label={tierLabel} />}
          </div>
          <h3 className="font-serif scholarship-card-title">
            <Link href={`/scholarships/${id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{scholarship.name}</Link>
          </h3>
          {scholarship.providerName && <span className="scholarship-card-provider">{scholarship.providerName}</span>}
        </div>
        {onToggleBookmark && (
          <button
            type="button"
            className="scholarship-card-bookmark"
            data-active={isBookmarked}
            aria-pressed={isBookmarked}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Save scholarship'}
            onClick={() => onToggleBookmark(scholarship)}
          >
            {isBookmarked ? '♥' : '♡'}
          </button>
        )}
      </div>

      <div className="scholarship-card-amount-box">
        <span className="scholarship-card-amount-label">Award Amount</span>
        <div className="scholarship-card-amount-value">{formatAward(scholarship.awardAmount)}</div>
      </div>

      {(scholarship.eligibility.exams?.length ?? 0) > 0 && (
        <div className="colleges-exam-chip-row">
          {scholarship.eligibility.exams.map(exam => <span key={exam} className="colleges-badge-editorial-sm">{exam}</span>)}
        </div>
      )}

      <p className="text-body" style={{ fontSize: '14px', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {scholarship.description}
      </p>

      <div className="scholarship-card-footer">
        <DeadlineChip deadline={scholarship.applicationDeadline} opensAt={scholarship.applicationOpensAt} />
        <Link href={`/scholarships/${id}`} className="btn-editorial-secondary scholarship-card-cta">View Details →</Link>
      </div>
    </div>
  );
}
