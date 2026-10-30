import { Injectable } from '@nestjs/common';
import { SavedCollegeRepository } from '../repositories/saved-college.repository';
import { CollegeRepository } from '../../colleges/repositories/college.repository';
import { WishlistEnrichmentService, CollegeEnrichment } from './wishlist-enrichment.service';
import { CollegeDocument } from '../../colleges/models/college.model';

export interface WishlistInsight {
  icon: string;
  text: string;
  collegeId?: string;
}

export interface WishlistScoreRow {
  collegeId: string;
  collegeName: string;
  aiRecommendationScore: number;
  admissionProbability: number | null;
  roiPercent: number | null;
  scholarshipEligible: boolean;
  budgetFit: boolean | null;
}

// Deterministic, rule-based (same tier as scholarships' RecommendationService)
// rather than an LLM call — fast, free, and consistent with how "AI
// Recommendation Score" already works elsewhere in the app.
@Injectable()
export class WishlistInsightsService {
  constructor(
    private readonly savedCollegeRepo: SavedCollegeRepository,
    private readonly collegeRepo: CollegeRepository,
    private readonly enrichment: WishlistEnrichmentService,
  ) {}

  async getInsights(userId: string): Promise<{ insights: WishlistInsight[]; scores: WishlistScoreRow[] }> {
    const savedDocs = await this.savedCollegeRepo.listForUser(userId);
    if (savedDocs.length === 0) return { insights: [], scores: [] };

    const colleges = await this.collegeRepo.findByIds(savedDocs.map(d => d.collegeId));
    const enrichmentByCollege = await this.enrichment.enrichMany(userId, colleges);

    const scores: WishlistScoreRow[] = colleges.map(c => {
      const e = enrichmentByCollege.get(c.id)!;
      return {
        collegeId: c.id, collegeName: c.name, aiRecommendationScore: e.aiRecommendationScore,
        admissionProbability: e.admissionProbability, roiPercent: e.roiPercent,
        scholarshipEligible: e.scholarshipEligible, budgetFit: e.budgetFit,
      };
    });

    return { insights: this.buildInsights(colleges, enrichmentByCollege), scores };
  }

  private buildInsights(colleges: CollegeDocument[], enrichmentByCollege: Map<string, CollegeEnrichment>): WishlistInsight[] {
    const insights: WishlistInsight[] = [];
    const placementOf = (c: CollegeDocument) => c.placementSummary?.[c.placementSummary.length - 1]?.placementPercentage ?? null;

    const topPlacement = this.maxBy(colleges, c => placementOf(c));
    if (topPlacement && placementOf(topPlacement) != null) {
      insights.push({
        icon: '📈', collegeId: topPlacement.id,
        text: `${topPlacement.name} has the highest placement rate among your saved colleges (${placementOf(topPlacement)}%).`,
      });
    }

    const topRoi = this.maxBy(colleges, c => enrichmentByCollege.get(c.id)!.roiPercent);
    if (topRoi) {
      insights.push({
        icon: '💰', collegeId: topRoi.id,
        text: `${topRoi.name} offers the best return on investment (${enrichmentByCollege.get(topRoi.id)!.roiPercent}% ROI).`,
      });
    }

    const topAdmission = this.maxBy(colleges, c => enrichmentByCollege.get(c.id)!.admissionProbability);
    if (topAdmission) {
      insights.push({
        icon: '🎯', collegeId: topAdmission.id,
        text: `You have the highest admission probability at ${topAdmission.name} (${enrichmentByCollege.get(topAdmission.id)!.admissionProbability}%).`,
      });
    }

    const withinBudget = colleges.filter(c => enrichmentByCollege.get(c.id)!.budgetFit === true);
    if (withinBudget.length > 0) {
      insights.push({
        icon: '✅',
        text: `${withinBudget.length} of your saved colleges fit your budget: ${withinBudget.map(c => c.name).join(', ')}.`,
      });
    }

    const scholarshipEligible = colleges.filter(c => enrichmentByCollege.get(c.id)!.scholarshipEligible);
    if (scholarshipEligible.length > 0) {
      insights.push({
        icon: '🎓',
        text: `You qualify for scholarships that apply to ${scholarshipEligible.length} of your saved colleges: ${scholarshipEligible.map(c => c.name).join(', ')}.`,
      });
    }

    const topScore = this.maxBy(colleges, c => enrichmentByCollege.get(c.id)!.aiRecommendationScore);
    const safest = colleges.find(c => enrichmentByCollege.get(c.id)!.admissionProbabilityBand === 'Safe' && c.id !== topScore?.id);
    if (topScore && safest) {
      insights.push({
        icon: '🛡',
        text: `${safest.name} is a safer bet than your current top pick, ${topScore.name} — higher admission probability at a similar profile.`,
      });
    }

    return insights;
  }

  private maxBy(colleges: CollegeDocument[], selector: (c: CollegeDocument) => number | null): CollegeDocument | null {
    let best: CollegeDocument | null = null;
    let bestValue = -Infinity;
    for (const c of colleges) {
      const value = selector(c);
      if (value != null && value > bestValue) { best = c; bestValue = value; }
    }
    return best;
  }
}
