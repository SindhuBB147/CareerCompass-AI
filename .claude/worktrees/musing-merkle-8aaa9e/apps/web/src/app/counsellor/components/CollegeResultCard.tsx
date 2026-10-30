'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collegesApi, type College } from '../../../lib/colleges-api';

function formatLakh(amount: number): string {
  return `₹${(amount / 100000).toFixed(2)} L`;
}

/**
 * Live-hydrated chat card: fetches the full college record via the same
 * public collegesApi.getDetail() the /colleges directory already uses, so
 * the chat message can show a real image + NIRF/placement stats instead of
 * just the bare {id, title} the AI response carries. Renders nothing on
 * fetch failure (a 404'd/renamed college, network hiccup) — the message's
 * own citations still carry the college's name/snippet, so a silent
 * omission here never blocks the rest of the answer from being useful.
 */
export function CollegeResultCard({ collegeId }: { collegeId: string }) {
  const [college, setCollege] = useState<College | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    collegesApi.getDetail(collegeId)
      .then(c => { if (!cancelled) setCollege(c); })
      .catch(() => { if (!cancelled) setCollege(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [collegeId]);

  if (loading) return <div className="chat-result-card-skeleton" aria-hidden="true" />;
  if (!college) return null;

  const latestPlacement = college.placementSummary?.[college.placementSummary.length - 1];

  return (
    <div className="card-editorial colleges-card chat-result-card">
      <div className="chat-result-card-compact-banner">
        <img src={college.bannerImage} alt="" loading="lazy" className="colleges-card-banner-img" />
        <div className="colleges-card-banner-overlay" />
        <div className="colleges-card-badges-top">
          {college.accreditation?.nirfRank && (
            <span className="colleges-badge colleges-badge-dark">NIRF #{college.accreditation.nirfRank}</span>
          )}
        </div>
      </div>
      <div style={{ padding: '16px 18px' }}>
        <h4 className="font-serif" style={{ fontSize: '16px', margin: '0 0 4px' }}>{college.name}</h4>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          📍 {college.city}, {college.state}
        </span>
        <div className="colleges-card-stats" style={{ marginTop: '12px' }}>
          <div>
            <span className="colleges-card-stat-label">Highest Package</span>
            <strong className="colleges-card-stat-value">{latestPlacement ? `₹${latestPlacement.highestPackage} LPA` : 'N/A'}</strong>
          </div>
          <div>
            <span className="colleges-card-stat-label">Avg Package</span>
            <strong className="colleges-card-stat-value">{latestPlacement ? `₹${latestPlacement.averagePackage} LPA` : 'N/A'}</strong>
          </div>
          <div>
            <span className="colleges-card-stat-label">Annual Fee</span>
            <strong className="colleges-card-stat-value colleges-card-stat-accent">{formatLakh(college.feeBreakdown?.totalAnnualFee ?? 0)}</strong>
          </div>
        </div>
        <Link href={`/colleges/${college.slug}`} className="btn-editorial-primary" style={{ marginTop: '14px', width: '100%', padding: '10px', fontSize: '13px' }}>
          View Details
        </Link>
      </div>
    </div>
  );
}
