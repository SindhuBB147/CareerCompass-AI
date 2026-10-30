import { Injectable, HttpStatus } from '@nestjs/common';
import { CollegeRepository } from '../../colleges/repositories/college.repository';
import { CollegeDocument, Course } from '../../colleges/models/college.model';
import { CutoffService } from '../../cutoffs/cutoff.service';
import { ScholarshipService } from '../../scholarships/services/scholarship.service';
import { DomainException } from '../../../common/filters/domain.exception';
import { PredictCollegesDto, PredictorFiltersDto } from '../dto/predict-colleges.dto';
import {
  courseOptionsForExam, courseMatchesSelection, courseMatchesDiscipline,
  resolveDisciplineOption, allowedCategoriesForExam, COMEDK_MERIT_CATEGORY,
  SupportedExam,
} from '../utils/course-matcher.util';
import {
  computeTrendingClosingRank, probabilityPercentFromRatio, bandFromPercent,
  confidenceFromDataPoints, ProbabilityBand5,
} from '../utils/prediction-math.util';

export interface RankedCollegeResult {
  collegeId: string;
  collegeName: string;
  collegeImage?: string;
  nirfRank: number | null;
  discipline: string;
  courseId: string;
  courseName: string;
  probabilityPercent: number;
  probabilityLevel: ProbabilityBand5;
  previousYearCutoff: number | null;
  expectedClosingRank: number | null;
  feePerYear: number | null;
  placementAverage: number | null;
  city: string;
  district?: string;
  collegeType: string;
  hostelAvailable: boolean;
  scholarshipsCount: number;
  rationale: {
    trendingClosingRank: number;
    studentRank: number;
    confidenceLevel: string;
    horizontalReservationBonus: number;
  };
}

export interface PredictCollegesResult {
  results: RankedCollegeResult[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
  insights: string[];
}

interface MatchedPair {
  college: CollegeDocument;
  course: Course;
}

const HORIZONTAL_BONUS_PER_RESERVATION = 2;
const HORIZONTAL_BONUS_CAP = 8;
const CACHE_TTL_MS = 60_000;

/**
 * Multi-college ranked Admission Probability Predictor. Separate from
 * (and additive to) `PredictionService`, which stays exactly as-is for the
 * single college+course 4-band path used by the AI Counsellor and the
 * choice-filling optimizer — see prediction-math.util.ts for the shared
 * pure-math extraction that keeps both paths consistent.
 */
@Injectable()
export class PredictionEngineService {
  private examCollegeCache = new Map<string, { fetchedAt: number; colleges: CollegeDocument[] }>();

  constructor(
    private readonly collegeRepo: CollegeRepository,
    private readonly cutoffService: CutoffService,
    private readonly scholarshipService: ScholarshipService,
  ) {}

  async predictColleges(dto: PredictCollegesDto): Promise<PredictCollegesResult> {
    this.validateRequest(dto);

    const examCode = dto.examCode;
    const disciplineOption = examCode === 'KCET' ? resolveDisciplineOption(dto.discipline!) : undefined;
    const disciplineValue = disciplineOption?.disciplineValue ?? 'Engineering';
    const effectiveCategory = examCode === 'COMEDK' ? COMEDK_MERIT_CATEGORY : dto.category!.toUpperCase();

    const colleges = await this.getCollegesForExam(examCode);
    const matches = this.matchCourses(colleges, examCode, disciplineValue, dto.discipline, dto.courseSelections ?? []);

    const scholarshipsCount = await this.scholarshipService.countMatchingForProfile(
      examCode === 'COMEDK' ? undefined : effectiveCategory,
      undefined,
      examCode,
    );

    const horizontalBonus = Math.min(
      HORIZONTAL_BONUS_CAP,
      (dto.horizontalReservations?.length ?? 0) * HORIZONTAL_BONUS_PER_RESERVATION,
    );

    const results: RankedCollegeResult[] = [];
    for (const { college, course } of matches) {
      const trend = await this.cutoffService.getTrend(college.id, course.courseId, examCode, effectiveCategory);
      const trendData = trend.map((t: any) => ({ year: t.year, closingRank: t.closingRank }));
      const trendingClosingRank = computeTrendingClosingRank(trendData);

      const ratio = trendingClosingRank > 0 ? dto.rank / trendingClosingRank : Infinity;
      const basePercent = trendingClosingRank > 0 ? probabilityPercentFromRatio(ratio) : 3;
      const finalPercent = Math.min(99, Math.max(1, basePercent + (trendingClosingRank > 0 ? horizontalBonus : 0)));
      const band = bandFromPercent(finalPercent);
      const confidence = confidenceFromDataPoints(trendData.length);

      const mostRecent = [...trend].sort((a: any, b: any) => b.year - a.year)[0];
      const latestPlacement = [...(college.placementSummary ?? [])].sort((a: any, b: any) => b.year - a.year)[0];

      results.push({
        collegeId: college.id,
        collegeName: college.name,
        collegeImage: college.bannerImage,
        nirfRank: college.accreditation?.nirfRank ?? null,
        discipline: course.discipline || 'Engineering',
        courseId: course.courseId,
        courseName: course.name,
        probabilityPercent: finalPercent,
        probabilityLevel: band,
        previousYearCutoff: mostRecent?.closingRank ?? null,
        expectedClosingRank: trendingClosingRank > 0 ? trendingClosingRank : null,
        feePerYear: course.feePerYear ?? college.feeBreakdown?.totalAnnualFee ?? null,
        placementAverage: latestPlacement?.averagePackage ?? null,
        city: college.city,
        district: college.district,
        collegeType: college.collegeType,
        hostelAvailable: Boolean(college.hostelInfo?.boysHostel || college.hostelInfo?.girlsHostel),
        scholarshipsCount,
        rationale: {
          trendingClosingRank, studentRank: dto.rank, confidenceLevel: confidence,
          horizontalReservationBonus: trendingClosingRank > 0 ? horizontalBonus : 0,
        },
      });
    }

    const filtered = this.applyFilters(results, dto.filters);
    const sorted = this.sortResults(filtered, dto.sortBy, dto.rank);
    const insights = this.buildInsights(sorted, dto);

    const totalResults = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / dto.limit));
    const start = (dto.page - 1) * dto.limit;
    const page = sorted.slice(start, start + dto.limit);

    return { results: page, page: dto.page, limit: dto.limit, totalPages, totalResults, insights };
  }

  // ── Validation ────────────────────────────────────────────────────────────

  private validateRequest(dto: PredictCollegesDto): void {
    const allowed = allowedCategoriesForExam(dto.examCode);
    if (allowed) {
      if (!dto.category) {
        throw new DomainException('VALIDATION_ERROR', `Category is required for ${dto.examCode}.`, HttpStatus.BAD_REQUEST);
      }
      if (!allowed.includes(dto.category.toUpperCase())) {
        throw new DomainException(
          'VALIDATION_ERROR',
          `"${dto.category}" is not a valid category for ${dto.examCode}. Allowed: ${allowed.join(', ')}.`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (dto.examCode === 'KCET') {
      if (!dto.discipline) {
        throw new DomainException('VALIDATION_ERROR', 'Discipline is required for KCET.', HttpStatus.BAD_REQUEST);
      }
      const option = resolveDisciplineOption(dto.discipline);
      if (!option) {
        throw new DomainException('VALIDATION_ERROR', `"${dto.discipline}" is not a recognized KCET discipline.`, HttpStatus.BAD_REQUEST);
      }
      if (option.disciplineValue === 'Engineering' && (!dto.courseSelections || dto.courseSelections.length === 0)) {
        throw new DomainException('VALIDATION_ERROR', 'Select at least one preferred course for Engineering.', HttpStatus.BAD_REQUEST);
      }
    } else {
      if (!dto.courseSelections || dto.courseSelections.length === 0) {
        throw new DomainException('VALIDATION_ERROR', 'Select at least one preferred course.', HttpStatus.BAD_REQUEST);
      }
    }
  }

  // ── Data fetch (cached) ──────────────────────────────────────────────────

  private async getCollegesForExam(examCode: SupportedExam): Promise<CollegeDocument[]> {
    const cached = this.examCollegeCache.get(examCode);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.colleges;

    const colleges = await this.collegeRepo.findByExamAndDiscipline(examCode);
    this.examCollegeCache.set(examCode, { fetchedAt: Date.now(), colleges });
    return colleges;
  }

  // ── Course matching ──────────────────────────────────────────────────────

  private matchCourses(
    colleges: CollegeDocument[],
    examCode: SupportedExam,
    disciplineValue: string,
    disciplineLabel: string | undefined,
    courseSelections: string[],
  ): MatchedPair[] {
    const pairs: MatchedPair[] = [];
    const isKcetNonEngineering = examCode === 'KCET' && disciplineValue !== 'Engineering';
    const optionSet = courseOptionsForExam(examCode);

    for (const college of colleges) {
      for (const course of college.courses) {
        if (!course.examsAccepted?.includes(examCode)) continue;

        if (examCode === 'KCET') {
          if (!courseMatchesDiscipline(course, disciplineValue)) continue;
          if (!isKcetNonEngineering && !courseMatchesSelection(course, courseSelections, optionSet)) continue;
        } else if (!courseMatchesSelection(course, courseSelections, optionSet)) {
          continue;
        }

        pairs.push({ college, course });
      }
    }
    return pairs;
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  private applyFilters(results: RankedCollegeResult[], filters?: PredictorFiltersDto): RankedCollegeResult[] {
    if (!filters) return results;
    return results.filter(r => {
      if (filters.collegeType && r.collegeType !== filters.collegeType) return false;
      if (filters.city && r.city.toLowerCase() !== filters.city.toLowerCase()) return false;
      if (filters.district && (r.district ?? r.city).toLowerCase() !== filters.district.toLowerCase()) return false;
      if (filters.minFee !== undefined && (r.feePerYear ?? 0) < filters.minFee) return false;
      if (filters.maxFee !== undefined && (r.feePerYear ?? Infinity) > filters.maxFee) return false;
      if (filters.hostelRequired && !r.hostelAvailable) return false;
      if (filters.minPlacementAverage !== undefined && (r.placementAverage ?? 0) < filters.minPlacementAverage) return false;
      if (filters.maxNirfRank !== undefined && (r.nirfRank ?? Infinity) > filters.maxNirfRank) return false;
      if (filters.minProbabilityPercent !== undefined && r.probabilityPercent < filters.minProbabilityPercent) return false;
      return true;
    });
  }

  // ── Sorting ───────────────────────────────────────────────────────────────

  private sortResults(results: RankedCollegeResult[], sortBy: 'nirf' | 'probability', studentRank: number): RankedCollegeResult[] {
    const cutoffMatchDistance = (r: RankedCollegeResult) =>
      r.expectedClosingRank !== null ? Math.abs(studentRank - r.expectedClosingRank) : Infinity;

    return [...results].sort((a, b) => {
      if (sortBy === 'nirf') {
        const nirfA = a.nirfRank ?? Infinity;
        const nirfB = b.nirfRank ?? Infinity;
        if (nirfA !== nirfB) return nirfA - nirfB;
      }
      if (b.probabilityPercent !== a.probabilityPercent) return b.probabilityPercent - a.probabilityPercent;
      if (sortBy === 'probability') {
        const nirfA = a.nirfRank ?? Infinity;
        const nirfB = b.nirfRank ?? Infinity;
        if (nirfA !== nirfB) return nirfA - nirfB;
      }
      return cutoffMatchDistance(a) - cutoffMatchDistance(b);
    });
  }

  // ── Smart insights (deterministic, rule-based) ───────────────────────────

  private buildInsights(results: RankedCollegeResult[], dto: PredictCollegesDto): string[] {
    const insights: string[] = [];

    if (results.length === 0) {
      insights.push('No colleges currently match your selections — try widening your course preferences or removing filters.');
      return insights;
    }

    const strong = results.filter(r => r.probabilityLevel === 'Very High' || r.probabilityLevel === 'High');
    if (strong.length > 0) {
      insights.push(`You have a ${strong[0].probabilityLevel} probability of admission to ${strong.length} college${strong.length > 1 ? 's' : ''}.`);
    }

    const closest = [...results]
      .filter(r => r.expectedClosingRank !== null)
      .sort((a, b) => Math.abs(dto.rank - a.expectedClosingRank!) - Math.abs(dto.rank - b.expectedClosingRank!))[0];
    if (closest) {
      const gap = Math.abs(dto.rank - closest.expectedClosingRank!);
      if (gap <= (closest.expectedClosingRank! * 0.1)) {
        insights.push(`Your rank is close to the previous cutoff at ${closest.collegeName} (${closest.courseName}).`);
      }
    }

    if (dto.examCode === 'KCET' && (dto.courseSelections?.length ?? 0) > 1) {
      const byCourse = new Map<string, number[]>();
      for (const r of results) {
        const list = byCourse.get(r.courseName) ?? [];
        list.push(r.probabilityPercent);
        byCourse.set(r.courseName, list);
      }
      const averages = [...byCourse.entries()].map(([name, pcts]) => ({
        name, avg: pcts.reduce((s, p) => s + p, 0) / pcts.length,
      })).sort((a, b) => b.avg - a.avg);
      if (averages.length > 1 && averages[0].avg - averages[averages.length - 1].avg >= 15) {
        insights.push(`Selecting ${averages[0].name} instead of ${averages[averages.length - 1].name} could improve your chances.`);
      }
    }

    const withRoi = results
      .filter(r => r.feePerYear && r.placementAverage)
      .map(r => ({ r, roiScore: r.placementAverage! / (r.feePerYear! / 100000) }))
      .sort((a, b) => b.roiScore - a.roiScore);
    if (withRoi.length > 0) {
      insights.push(`${withRoi[0].r.collegeName} offers strong ROI among your matches (placement-to-fee ratio).`);
    }

    const safest = results.filter(r => r.probabilityLevel === 'Very High').slice(0, 2);
    if (safest.length === 2) {
      insights.push(`${safest[0].collegeName} and ${safest[1].collegeName} are your safest choices.`);
    }

    return insights;
  }
}
