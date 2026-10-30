import { Injectable } from '@nestjs/common';
import { CollegeDocument } from '../../colleges/models/college.model';
import { SearchEntities } from '../../../common/ai-client/ai-service.client';
import { StudentContext } from '../../../common/utils/student-context.util';

export interface ScoreBreakdown {
  entityMatch: number;
  personalizationFit: number;
  dataQuality: number;
  textRelevance: number;
  actionIntentBoost: number;
}

export interface RankedCollege {
  college: CollegeDocument;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface RankOptions {
  /** College _ids explicitly named in a "compare X and Y" query — always boosted to the top. */
  compareBoostIds?: Set<string>;
  /** Admission probability (0-100) per college _id, when already computed for a candidate. */
  admissionProbabilityById?: Map<string, number>;
}

const WEIGHTS = {
  entityMatch: 0.35,
  personalizationFit: 0.30,
  dataQuality: 0.15,
  textRelevance: 0.10,
  actionIntentBoost: 0.10,
};

/**
 * Scores College candidates for Smart Search. Only Colleges (and, more
 * lightly, Scholarships — not ranked here) are genuine multi-candidate
 * ranking problems in this platform; Predictions/Financial/Roadmap results
 * are per-user, per-candidate lookups, not something to sort a list by (see
 * search.service.ts's enrichment step). Every sub-score is normalized to
 * [0,1]; missing optional data defaults to a neutral value, never 0, so
 * colleges lacking e.g. a NIRF rank aren't unfairly punished.
 */
@Injectable()
export class CollegeRankingService {
  rank(
    candidates: CollegeDocument[],
    entities: SearchEntities,
    studentContext: StudentContext,
    options: RankOptions = {},
  ): RankedCollege[] {
    const placementQ3 = this.placementTopQuartileThreshold(candidates);

    return candidates
      .map((college) => {
        const breakdown: ScoreBreakdown = {
          entityMatch: this.entityMatchScore(college, entities),
          personalizationFit: this.personalizationFitScore(college, entities, studentContext, options),
          dataQuality: this.dataQualityScore(college),
          textRelevance: 0, // no leftover free-text scoring in v1 — see search-aggregator.service.ts
          actionIntentBoost: this.actionIntentBoostScore(college, entities, options, placementQ3),
        };
        const score =
          WEIGHTS.entityMatch * breakdown.entityMatch +
          WEIGHTS.personalizationFit * breakdown.personalizationFit +
          WEIGHTS.dataQuality * breakdown.dataQuality +
          WEIGHTS.textRelevance * breakdown.textRelevance +
          WEIGHTS.actionIntentBoost * breakdown.actionIntentBoost;
        return { college, score, breakdown };
      })
      .sort((a, b) => b.score - a.score);
  }

  private entityMatchScore(college: CollegeDocument, entities: SearchEntities): number {
    const checks: boolean[] = [];
    const c: any = college;

    // Mirrors CollegeRepository.search()'s discipline-filter fallback and
    // predictions' course-matcher.util.ts: missing course.discipline defaults
    // to 'Engineering', so a raw strict-equality check would wrongly score
    // real Engineering matches as non-matches whenever that field is unset.
    if (entities.discipline) checks.push((c.courses ?? []).some((course: any) => (course.discipline || 'Engineering') === entities.discipline));
    if (entities.exam) checks.push((c.courses ?? []).some((course: any) => (course.examsAccepted ?? []).includes(entities.exam)));
    if (entities.city) checks.push(c.city === entities.city);
    if (entities.college_type) checks.push(c.collegeType === entities.college_type);
    if (entities.budget_max != null) checks.push((c.feeBreakdown?.totalAnnualFee ?? Infinity) <= entities.budget_max);
    if (entities.nirf_max != null) checks.push(c.accreditation?.nirfRank != null && c.accreditation.nirfRank <= entities.nirf_max);
    if (entities.hostel_required) checks.push(Boolean(c.hostelInfo?.boysHostel || c.hostelInfo?.girlsHostel));

    if (checks.length === 0) return 0.5; // pure free-text query — no structured entity to grade against
    return checks.filter(Boolean).length / checks.length;
  }

  private personalizationFitScore(
    college: CollegeDocument,
    entities: SearchEntities,
    studentContext: StudentContext,
    options: RankOptions,
  ): number {
    const c: any = college;
    const signals: number[] = [];

    const probability = options.admissionProbabilityById?.get(String(c._id));
    if (probability != null) {
      signals.push(probability / 100);
    } else if (studentContext.rank) {
      const cutoffs = (c.courses ?? []).map((course: any) => course.cutoffRankSummary).filter((r: unknown): r is number => typeof r === 'number');
      if (cutoffs.length > 0) {
        const bestCutoff = Math.min(...cutoffs);
        signals.push(1 - Math.min(Math.abs(studentContext.rank - bestCutoff) / bestCutoff, 1));
      }
    }

    const budgetMax = entities.budget_max ?? studentContext.budgetMax;
    const fee = c.feeBreakdown?.totalAnnualFee;
    if (budgetMax != null && fee != null) {
      signals.push(fee <= budgetMax ? 1 : Math.max(0, 1 - (fee - budgetMax) / budgetMax));
    }

    // Location fit is always computable (never skipped) — neutral when there's no location signal at all.
    if (entities.city) {
      signals.push(c.city === entities.city ? 1 : 0);
    } else if (studentContext.preferredStates?.length) {
      signals.push(studentContext.preferredStates.includes(c.state) ? 1 : 0.5);
    } else {
      signals.push(0.5);
    }

    return signals.reduce((sum, s) => sum + s, 0) / signals.length;
  }

  private dataQualityScore(college: CollegeDocument): number {
    const c: any = college;
    const nirfRank = c.accreditation?.nirfRank;
    const nirfScore = nirfRank != null ? 1 - Math.min(nirfRank, 300) / 300 : 0.4;
    const ratingScore = typeof c.rating === 'number' ? c.rating / 5 : 0.5;
    return 0.5 * nirfScore + 0.5 * ratingScore;
  }

  private actionIntentBoostScore(
    college: CollegeDocument,
    entities: SearchEntities,
    options: RankOptions,
    placementQ3: number | undefined,
  ): number {
    const c: any = college;
    if (options.compareBoostIds?.has(String(c._id))) return 1.0;

    if (entities.placement_focus && placementQ3 != null) {
      const avgPackage = this.latestAveragePackage(college);
      if (avgPackage != null && avgPackage >= placementQ3) return 0.3;
    }
    return 0;
  }

  private latestAveragePackage(college: CollegeDocument): number | undefined {
    const c: any = college;
    const placements = c.placementSummary ?? [];
    if (placements.length === 0) return undefined;
    const latest = [...placements].sort((a: any, b: any) => b.year - a.year)[0];
    return latest?.averagePackage;
  }

  private placementTopQuartileThreshold(candidates: CollegeDocument[]): number | undefined {
    const packages = candidates
      .map((c) => this.latestAveragePackage(c))
      .filter((p): p is number => typeof p === 'number')
      .sort((a, b) => a - b);
    if (packages.length === 0) return undefined;
    return packages[Math.floor(packages.length * 0.75)];
  }
}
