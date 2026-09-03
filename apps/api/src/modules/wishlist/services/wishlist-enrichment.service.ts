import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Prediction, PredictionDocument } from '../../predictions/models/prediction.model';
import { ScholarshipService } from '../../scholarships/services/scholarship.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { CollegeDocument } from '../../colleges/models/college.model';

export interface CollegeEnrichment {
  admissionProbability: number | null;
  admissionProbabilityBand: string | null;
  roiPercent: number | null;
  paybackYears: number | null;
  placementPercentage: number | null;
  aiRecommendationScore: number;
  scholarshipEligible: boolean;
  scholarshipCount: number;
  budgetFit: boolean | null;
}

// Composite score weights — redistributed across whichever signals are
// actually available for a given (student, college) pair, so a college the
// student hasn't run a prediction for yet still gets a reasonable score
// instead of being penalized for missing data.
const WEIGHTS = { admission: 0.35, roi: 0.25, placement: 0.20, budget: 0.10, scholarship: 0.10 };

@Injectable()
export class WishlistEnrichmentService {
  constructor(
    @InjectModel(Prediction.name) private readonly predictionModel: Model<PredictionDocument>,
    private readonly scholarshipService: ScholarshipService,
    private readonly userRepo: UserRepository,
  ) {}

  /** Batches the per-user lookups (predictions, matched scholarships, budget)
   * once, then scores every saved college in-memory — avoids N+1 queries. */
  async enrichMany(userId: string, colleges: CollegeDocument[]): Promise<Map<string, CollegeEnrichment>> {
    const [predictions, matchedScholarships, user] = await Promise.all([
      this.predictionModel.find({ userId, examCode: { $ne: 'ROI' } }).exec(),
      this.scholarshipService.getMatched(userId).catch(() => []),
      this.userRepo.findById(userId),
    ]);
    const roiDocs = await this.predictionModel.find({ userId, examCode: 'ROI' }).exec();
    const budgetMax = user?.preferences?.budgetMax ?? null;

    const result = new Map<string, CollegeEnrichment>();
    for (const college of colleges) {
      const collegeId = (college.id ?? String((college as unknown as { _id: unknown })._id)) as string;
      const bestPrediction = predictions
        .filter(p => p.collegeId === collegeId)
        .sort((a, b) => (b.probabilityPercent ?? 0) - (a.probabilityPercent ?? 0))[0];
      const roiDoc = roiDocs.find(p => p.collegeId === collegeId);

      const admissionProbability = bestPrediction?.probabilityPercent ?? null;
      const admissionProbabilityBand = bestPrediction?.probabilityBand ?? null;
      const roiPercent = roiDoc?.roiEstimate?.roiPercent ?? null;
      const paybackYears = roiDoc?.roiEstimate?.paybackYears ?? null;
      const latestPlacement = college.placementSummary?.[college.placementSummary.length - 1];
      const placementPercentage = latestPlacement?.placementPercentage ?? null;

      const scholarshipCount = matchedScholarships.filter(s => this.appliesToCollege(s, college)).length;
      const scholarshipEligible = scholarshipCount > 0;

      const totalAnnualFee = college.feeBreakdown?.totalAnnualFee ?? null;
      const budgetFit = budgetMax != null && totalAnnualFee != null ? totalAnnualFee <= budgetMax : null;

      const aiRecommendationScore = this.computeScore({
        admissionProbability, roiPercent, placementPercentage, budgetMax, totalAnnualFee, scholarshipCount,
      });

      result.set(collegeId, {
        admissionProbability, admissionProbabilityBand, roiPercent, paybackYears, placementPercentage,
        aiRecommendationScore, scholarshipEligible, scholarshipCount, budgetFit,
      });
    }
    return result;
  }

  async enrichOne(userId: string, college: CollegeDocument): Promise<CollegeEnrichment> {
    const map = await this.enrichMany(userId, [college]);
    const collegeId = (college.id ?? String((college as unknown as { _id: unknown })._id)) as string;
    return map.get(collegeId)!;
  }

  private appliesToCollege(scholarship: { eligibility: { applicableCourses: string[] } }, college: CollegeDocument): boolean {
    const applicable = scholarship.eligibility?.applicableCourses;
    if (!applicable?.length) return true; // open to all courses
    const haystack = college.courses.map(c => `${c.name} ${c.degreeType} ${c.discipline}`).join(' ').toLowerCase();
    return applicable.some(c => haystack.includes(c.toLowerCase()));
  }

  private computeScore(input: {
    admissionProbability: number | null; roiPercent: number | null; placementPercentage: number | null;
    budgetMax: number | null; totalAnnualFee: number | null; scholarshipCount: number;
  }): number {
    const components: Array<{ weight: number; value: number }> = [];
    if (input.admissionProbability != null) components.push({ weight: WEIGHTS.admission, value: input.admissionProbability });
    if (input.roiPercent != null) components.push({ weight: WEIGHTS.roi, value: Math.max(0, Math.min(100, (input.roiPercent / 150) * 100)) });
    if (input.placementPercentage != null) components.push({ weight: WEIGHTS.placement, value: input.placementPercentage });
    if (input.budgetMax != null && input.totalAnnualFee != null) {
      const overBudgetPercent = ((input.totalAnnualFee - input.budgetMax) / input.budgetMax) * 100;
      components.push({ weight: WEIGHTS.budget, value: Math.max(0, Math.min(100, 100 - overBudgetPercent)) });
    }
    components.push({ weight: WEIGHTS.scholarship, value: Math.min(input.scholarshipCount, 3) / 3 * 100 });

    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight === 0) return 0;
    const weighted = components.reduce((sum, c) => sum + c.weight * c.value, 0) / totalWeight;
    return Math.round(weighted);
  }
}
