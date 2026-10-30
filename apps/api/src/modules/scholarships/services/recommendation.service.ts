import { Injectable } from '@nestjs/common';
import { EligibilityEngineService, EligibilityProfile, EligibilityReport } from './eligibility-engine.service';
import { ScholarshipDocument } from '../models/scholarship.model';

export type RecommendationTier = 'highly_recommended' | 'recommended' | 'eligible' | 'almost_eligible';

export const RECOMMENDATION_TIER_LABELS: Record<RecommendationTier, string> = {
  highly_recommended: 'Highly Recommended',
  recommended: 'Recommended',
  eligible: 'Eligible',
  almost_eligible: 'Almost Eligible',
};

export interface ScholarshipRecommendation {
  scholarship: ScholarshipDocument;
  eligibility: EligibilityReport;
  tier: RecommendationTier;
  tierLabel: string;
}

@Injectable()
export class RecommendationService {
  constructor(private readonly eligibilityEngine: EligibilityEngineService) {}

  /** Ranks a student's eligible/near-eligible scholarships, highest-value
   * first. Scholarships the student is clearly NOT eligible for are
   * excluded — they still surface via plain browse/search, just not here. */
  recommend(profile: EligibilityProfile, scholarships: ScholarshipDocument[], limit?: number): ScholarshipRecommendation[] {
    const scored = scholarships
      .map(scholarship => {
        const eligibility = this.eligibilityEngine.evaluate(profile, scholarship);
        return { scholarship, eligibility, tier: this.tierFor(eligibility) };
      })
      .filter((r): r is { scholarship: ScholarshipDocument; eligibility: EligibilityReport; tier: RecommendationTier } => r.tier !== null)
      .map(r => ({ ...r, tierLabel: RECOMMENDATION_TIER_LABELS[r.tier] }))
      .sort((a, b) => b.eligibility.score - a.eligibility.score);

    return limit ? scored.slice(0, limit) : scored;
  }

  private tierFor(report: EligibilityReport): RecommendationTier | null {
    if (report.verdict === 'not_eligible') return null;

    if (report.verdict === 'eligible') {
      const courseMatched = report.checks.find(c => c.key === 'course')?.result === 'pass';
      return courseMatched || report.score >= 90 ? 'highly_recommended' : 'recommended';
    }

    // partially_eligible
    return report.score >= 60 ? 'eligible' : 'almost_eligible';
  }
}
