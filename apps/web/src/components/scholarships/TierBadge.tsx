'use client';

import type { RecommendationTier } from '../../lib/scholarships-api';

const ICONS: Record<RecommendationTier, string> = {
  highly_recommended: '★',
  recommended: '✓',
  eligible: '◐',
  almost_eligible: '?',
};

export function TierBadge({ tier, label }: { tier: RecommendationTier; label: string }) {
  return (
    <span className="scholarship-tier-badge" data-tier={tier}>
      {ICONS[tier]} {label}
    </span>
  );
}
