import { Injectable, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { CollegeRepository } from '../../colleges/repositories/college.repository';
import { CollegeDocument, Course } from '../../colleges/models/college.model';
import { CutoffService } from '../../cutoffs/cutoff.service';
import { CutoffDocument } from '../../cutoffs/models/cutoff.model';
import { ScholarshipService } from '../../scholarships/services/scholarship.service';
import { DomainException } from '../../../common/filters/domain.exception';
import { PredictCollegesDto, PredictorFiltersDto } from '../dto/predict-colleges.dto';
import {
  courseOptionsForExam, courseMatchesSelection, courseMatchesDiscipline,
  resolveDisciplineOption, allowedCategoriesForExam,
  SupportedExam,
} from '../utils/course-matcher.util';
import {
  confidenceFromDataPoints,
} from '../utils/prediction-math.util';



export interface RankedCollegeResult {
  collegeId: string;
  collegeName: string;
  collegeImage?: string;
  nirfRank: number | null;
  discipline: string;
  courseId: string;
  courseName: string;
  probabilityPercent: null;
  probabilityLevel: string;
  previousYearCutoff: number | null;
  expectedClosingRank: number | null;
  feePerYear: number | null;
  placementAverage: number | null;
  city: string;
  district?: string;
  aliases: string[];
  collegeType: string;
  hostelAvailable: boolean;
  scholarshipsCount: number;
  rationale: {
    trendingClosingRank: number;
    studentRank: number;
    confidenceLevel: string;
    horizontalReservationBonus: number;
  };
  dataStatus?: 'complete' | 'insufficient';
  historicalCutoffs: Array<{ year: number; round: number; phase?: number | string | null; category: string; closingRank: number; source?: string; sourceUrl?: string; sourceCollegeCode?: string; sourceBranchCode?: string }>;
  branches?: Array<{
    courseId: string;
    courseName: string;
    probabilityPercent: number | null;
    probabilityLevel: string;
    previousYearCutoff: number | null;
    dataStatus?: 'complete' | 'insufficient';
    historicalCutoffs: RankedCollegeResult['historicalCutoffs'];
  }>;
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

const CACHE_TTL_MS = 60_000;
const KCET_CATEGORY_BASE: Record<string, string> = {
  GM: 'GM', SC: 'SCG', ST: 'STG', 'CAT-1': '1G',
  '2A': '2AG', '2B': '2BG', '3A': '3AG', '3B': '3BG',
};
const KCET_SUPPORTED_HORIZONTAL = new Set(['Rural Quota', 'Kannada Medium']);
const KARNATAKA_LOCATION_ALIASES: string[][] = [
  ['mangaluru', 'mangalore'], ['mysuru', 'mysore'], ['shivamogga', 'shimoga'],
  ['belagavi', 'belgaum'], ['ballari', 'bellary'], ['vijayapura', 'bijapur'],
  ['tumakuru', 'tumkur'], ['kalaburagi', 'gulbarga'], ['chikkamagaluru', 'chikmagalur'],
  ['bagalkot', 'bagalkote'],
];

function matchesKarnatakaLocation(value: string | undefined, requested: string): boolean {
  const normalize = (text: string) => text.trim().toLocaleLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
  const target = normalize(requested);
  const aliases = KARNATAKA_LOCATION_ALIASES.find((group) => group.includes(target)) ?? [target];
  const normalizedValue = normalize(value ?? '');
  return aliases.some((alias) => normalizedValue.includes(alias));
}

function kcetCutoffCategory(category: string, reservations: string[] = []): string {
  const base = KCET_CATEGORY_BASE[category.trim().toUpperCase()];
  const reservation = reservations[0];
  if (reservation === 'Rural Quota') return base === 'GM' ? 'GMR' : `${base.slice(0, -1)}R`;
  if (reservation === 'Kannada Medium') return base === 'GM' ? 'GMK' : `${base.slice(0, -1)}K`;
  return base;
}

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

    // COMEDK has its own source-keyed cutoff path. It deliberately does not
    // consult courses.examsAccepted or the KCET category/rank logic below.
    if (dto.examCode === 'COMEDK') return this.predictComedk(dto);

    const examCode = dto.examCode;
    const disciplineOption = examCode === 'KCET' ? resolveDisciplineOption(dto.discipline!) : undefined;
    const disciplineValue = disciplineOption?.disciplineValue ?? 'Engineering';
    const effectiveCategory = examCode === 'KCET'
      ? kcetCutoffCategory(dto.category!, dto.horizontalReservations)
      : dto.category!.trim().toUpperCase();

    const verifiedExamCutoffs = await this.cutoffService.countVerifiedCutoffs(examCode);
    if (verifiedExamCutoffs === 0) {
      throw new DomainException(
        'INSUFFICIENT_DATA',
        `No verified ${examCode} cutoff records are available. Recommendations are disabled until official cutoff data is imported and verified.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const colleges = await this.getCollegesForExam(examCode);
    const matches = this.matchCourses(colleges, examCode, disciplineValue, dto.discipline, dto.courseSelections ?? []);


    const scholarshipsCount = await this.scholarshipService.countMatchingForProfile(
      effectiveCategory,
      undefined,
      examCode,
    );

    const results: RankedCollegeResult[] = [];
    for (const { college, course } of matches) {
      const trend = await this.cutoffService.getTrend(college.id, course.courseId, examCode, effectiveCategory);
      const historicalCutoffs = trend.map((t: any) => ({ year: t.year, round: t.round, category: t.category, closingRank: t.closingRank, source: t.source }));
      const ranks = historicalCutoffs.map(c => c.closingRank);
      const historicalYearCount = new Set(historicalCutoffs.map(c => c.year)).size;
      const rankPosition = ranks.length === 0 ? 'insufficient' : dto.rank < Math.min(...ranks) ? 'better' : dto.rank > Math.max(...ranks) ? 'worse' : 'within';
      const evidenceLabel = historicalYearCount === 0 ? 'Insufficient cutoff data'
        : historicalYearCount < 2 ? 'Insufficient multi-year cutoff data'
        : rankPosition === 'better' ? 'Better than all observed cutoffs'
        : rankPosition === 'within' ? 'Within the observed cutoff range'
          : rankPosition === 'worse' ? 'Beyond all observed cutoffs' : 'Insufficient cutoff data';
      const confidence = confidenceFromDataPoints(historicalYearCount);

      const mostRecent = [...trend].sort((a: any, b: any) => b.year - a.year || b.round - a.round)[0];
      const latestPlacement = [...(college.placementSummary ?? [])].sort((a: any, b: any) => b.year - a.year)[0];

      results.push({
        collegeId: college.id,
        collegeName: college.name,
        collegeImage: college.bannerImage,
        nirfRank: college.accreditation?.nirfRank ?? null,
        discipline: course.discipline || 'Engineering',
        courseId: course.courseId,
        courseName: course.name,
        probabilityPercent: null,
        probabilityLevel: evidenceLabel,
        previousYearCutoff: mostRecent?.closingRank ?? null,
        expectedClosingRank: null,
        feePerYear: course.feePerYear ?? college.feeBreakdown?.totalAnnualFee ?? null,
        placementAverage: latestPlacement?.averagePackage ?? null,
        city: college.city,
        district: college.district,
        aliases: college.aliasNames ?? [],
        collegeType: college.collegeType,
        hostelAvailable: Boolean(college.hostelInfo?.boysHostel || college.hostelInfo?.girlsHostel),
        scholarshipsCount,
        rationale: {
          trendingClosingRank: 0, studentRank: dto.rank, confidenceLevel: confidence,
          horizontalReservationBonus: 0,
        },
        dataStatus: historicalYearCount < 2 ? 'insufficient' : 'complete',
        historicalCutoffs,
      });
    }

    const filteredBranches = this.applyFilters(results, dto.filters, 'KCET');
    const branchesByCollege = new Map<string, RankedCollegeResult[]>();
    for (const result of filteredBranches) {
      const group = branchesByCollege.get(result.collegeId) ?? [];
      if (!group.some((branch) => branch.courseId === result.courseId)) group.push(result);
      branchesByCollege.set(result.collegeId, group);
    }
    const filtered = [...branchesByCollege.values()].map((branches) => {
      const ordered = [...branches].sort((a, b) => {
        const probabilityDelta = (b.probabilityPercent ?? -1) - (a.probabilityPercent ?? -1);
        return probabilityDelta || ((b.previousYearCutoff ?? 0) - dto.rank) - ((a.previousYearCutoff ?? 0) - dto.rank);
      });
      const representative = ordered[0];
      return {
        ...representative,
        branches: ordered.map((branch) => ({
          courseId: branch.courseId,
          courseName: branch.courseName,
          probabilityPercent: branch.probabilityPercent,
          probabilityLevel: branch.probabilityLevel,
          previousYearCutoff: branch.previousYearCutoff,
          dataStatus: branch.dataStatus,
          historicalCutoffs: branch.historicalCutoffs,
        })),
      };
    });
    const sorted = this.sortResults(filtered, dto.sortBy);
    const insights = this.buildInsights(sorted);

    const totalResults = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / dto.limit));
    const start = (dto.page - 1) * dto.limit;
    const page = sorted.slice(start, start + dto.limit);

    return { results: page, page: dto.page, limit: dto.limit, totalPages, totalResults, insights };
  }

  private async predictComedk(dto: PredictCollegesDto): Promise<PredictCollegesResult> {
    const verifiedCount = await this.cutoffService.countVerifiedCutoffs('COMEDK');
    if (verifiedCount === 0) {
      throw new DomainException('INSUFFICIENT_DATA', 'No verified COMEDK cutoff records are available.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const cutoffs = await this.cutoffService.findVerifiedCutoffs('COMEDK', {
      category: dto.category,
      year: dto.cutoffYear,
      round: dto.cutoffRound,
    });
    if (cutoffs.length === 0) {
      const requested = [dto.category && `seat type ${dto.category}`, dto.cutoffYear && `year ${dto.cutoffYear}`, dto.cutoffRound && `Round ${dto.cutoffRound}`].filter(Boolean).join(', ');
      throw new DomainException('INSUFFICIENT_DATA', `No verified COMEDK cutoff evidence is available for ${requested || 'the selected filters'}.`, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const collegeIds = [...new Set(cutoffs.map((cutoff) => cutoff.collegeId))];
    const collegeDocs = await this.collegeRepo.findByIds(collegeIds);
    const colleges = new Map(collegeDocs.map((college) => [college.id, college]));
    const options = courseOptionsForExam('COMEDK');
    const selected = dto.courseSelections ?? [];
    const grouped = new Map<string, { college: CollegeDocument; courseId: string; courseName: string; rows: CutoffDocument[] }>();

    for (const cutoff of cutoffs) {
      const college = colleges.get(cutoff.collegeId);
      if (!college || college.isVerified === false || college.status === 'archived') continue;
      const courseName = cutoff.courseName || cutoff.branch || cutoff.courseId;
      if (!courseMatchesSelection({ name: courseName, degreeType: 'B.E.', discipline: 'Engineering' }, selected, options)) continue;

      const key = `${cutoff.collegeId}|${cutoff.courseId}|${cutoff.category}`;
      const current: { college: CollegeDocument; courseId: string; courseName: string; rows: CutoffDocument[] } =
        grouped.get(key) ?? { college, courseId: cutoff.courseId, courseName, rows: [] };
      current.rows.push(cutoff);
      grouped.set(key, current);
    }

    const scholarshipsCount = await this.scholarshipService.countMatchingForProfile(undefined, undefined, 'COMEDK');
    const results: RankedCollegeResult[] = [];
    for (const { college, courseId, courseName, rows } of grouped.values()) {
      const historicalCutoffs = rows
        .sort((a, b) => a.year - b.year || a.round - b.round)
        .map((row) => ({
          year: row.year,
          round: row.round,
          phase: row.metadata?.sourcePhase ?? null,
          category: row.category,
          closingRank: row.closingRank,
          source: row.source,
          sourceUrl: row.metadata?.sourceUrl,
          sourceCollegeCode: row.metadata?.comedkCollegeCode,
          sourceBranchCode: row.metadata?.comedkBranchCode ?? row.courseId,
        }));
      const ranks = historicalCutoffs.map((row) => row.closingRank);
      const yearCount = new Set(historicalCutoffs.map((row) => row.year)).size;
      const rankPosition = dto.rank < Math.min(...ranks) ? 'better'
        : dto.rank > Math.max(...ranks) ? 'beyond' : 'within';
      const latest = historicalCutoffs[historicalCutoffs.length - 1];
      const singleYear = `the ${latest.year} historical closing rank`;
      const comparison = yearCount < 2
        ? rankPosition === 'beyond' ? `Beyond ${singleYear}` : rankPosition === 'better' ? `Better than ${singleYear}` : `Within ${singleYear}`
        : rankPosition === 'beyond' ? 'Beyond all observed COMEDK closing ranks' : rankPosition === 'better' ? 'Better than all observed COMEDK closing ranks' : 'Within the observed COMEDK closing rank range';
      const placement = [...(college.placementSummary ?? [])].sort((a: any, b: any) => b.year - a.year)[0];

      results.push({
        collegeId: college.id,
        collegeName: college.name,
        collegeImage: college.bannerImage,
        nirfRank: college.accreditation?.nirfRank ?? null,
        discipline: 'Engineering',
        courseId,
        courseName,
        probabilityPercent: null,
        probabilityLevel: comparison,
        previousYearCutoff: latest?.closingRank ?? null,
        expectedClosingRank: null,
        feePerYear: college.feeBreakdown?.byQuota?.comedkFee ?? college.feeBreakdown?.totalAnnualFee ?? null,
        placementAverage: placement?.averagePackage ?? null,
        city: college.city,
        district: college.district,
        aliases: college.aliasNames ?? [],
        collegeType: college.collegeType,
        hostelAvailable: Boolean(college.hostelInfo?.boysHostel || college.hostelInfo?.girlsHostel),
        scholarshipsCount,
        rationale: { trendingClosingRank: 0, studentRank: dto.rank, confidenceLevel: confidenceFromDataPoints(yearCount), horizontalReservationBonus: 0 },
        dataStatus: yearCount < 2 ? 'insufficient' : 'complete',
        historicalCutoffs,
      });
    }

    const filtersWithoutLocation = dto.filters
      ? { ...dto.filters, city: undefined, district: undefined }
      : undefined;
    const filteredBranches = this.applyFilters(results, filtersWithoutLocation, 'COMEDK').filter((result) => {
      if (dto.filters?.city && !matchesKarnatakaLocation(result.city, dto.filters.city)) return false;
      if (dto.filters?.district && !matchesKarnatakaLocation(result.district ?? result.city, dto.filters.district)) return false;
      return true;
    });
    // Course selection and all user filters are applied per branch above. Keep
    // one result per stable college ID, choosing the branch with the strongest
    // observed rank fit while retaining only that branch's cutoff evidence.
    const branchesByCollege = new Map<string, RankedCollegeResult[]>();
    const rankFit = (result: RankedCollegeResult) => (result.previousYearCutoff ?? 0) - dto.rank;
    for (const result of filteredBranches) {
      const group = branchesByCollege.get(result.collegeId) ?? [];
      if (!group.some((branch) => branch.courseId === result.courseId)) group.push(result);
      branchesByCollege.set(result.collegeId, group);
    }
    const filtered = [...branchesByCollege.values()].map((branches) => {
      const ordered = [...branches].sort((a, b) => rankFit(b) - rankFit(a));
      const representative = ordered[0];
      return {
        ...representative,
        branches: ordered.map((branch) => ({
          courseId: branch.courseId,
          courseName: branch.courseName,
          probabilityPercent: branch.probabilityPercent,
          probabilityLevel: branch.probabilityLevel,
          previousYearCutoff: branch.previousYearCutoff,
          dataStatus: branch.dataStatus,
          historicalCutoffs: branch.historicalCutoffs,
        })),
      };
    });
    const sorted = dto.sortBy === 'nirf'
      ? [...filtered].sort((a, b) => ((b.previousYearCutoff ?? 0) - dto.rank) - ((a.previousYearCutoff ?? 0) - dto.rank) ||
        (a.collegeName || '').localeCompare(b.collegeName || ''))
      : this.sortResults(filtered, dto.sortBy);
    const totalResults = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / dto.limit));
    const start = (dto.page - 1) * dto.limit;
    const page = sorted.slice(start, start + dto.limit);
    const insights = totalResults === 0
      ? ['No verified COMEDK records match the selected branches and filters.']
      : [`${totalResults} unique colleges matched. Each card shows its best rank-fit selected branch using verified historical COMEDK cutoff evidence. This is a historical comparison, not an admission probability.`];
    return { results: page, page: dto.page, limit: dto.limit, totalPages, totalResults, insights };
  }

  // ── Validation ────────────────────────────────────────────────────────────

  private validateRequest(dto: PredictCollegesDto): void {
    const reservations = dto.horizontalReservations ?? [];
    if (dto.examCode === 'KCET') {
      const unsupported = reservations.filter(value => !KCET_SUPPORTED_HORIZONTAL.has(value));
      if (unsupported.length > 0) {
        throw new DomainException(
          'UNSUPPORTED_FILTER',
          `KCET horizontal reservation data is available only for Rural Quota and Kannada Medium; unsupported: ${unsupported.join(', ')}.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      if (reservations.length > 1) {
        throw new DomainException('VALIDATION_ERROR', 'Select at most one KCET horizontal reservation.', HttpStatus.BAD_REQUEST);
      }
    } else if (reservations.length > 0) {
      throw new DomainException(
        'UNSUPPORTED_FILTER',
        `Horizontal reservation filters are not currently supported for ${dto.examCode}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!['nirf', 'fee_asc', 'placement_desc'].includes(dto.sortBy)) {
      throw new DomainException('UNSUPPORTED_SORT', 'Sorting by admission probability is unavailable because probabilities are not currently estimated.', HttpStatus.BAD_REQUEST);
    }
    if (dto.filters?.minProbabilityPercent !== undefined) {
      throw new DomainException('UNSUPPORTED_FILTER', 'Probability filtering is unavailable because admission probabilities are not currently estimated.', HttpStatus.BAD_REQUEST);
    }
    const allowed = allowedCategoriesForExam(dto.examCode);
    if (allowed) {
      if (!dto.category) {
        throw new DomainException('VALIDATION_ERROR', `Category is required for ${dto.examCode}.`, HttpStatus.BAD_REQUEST);
      }
      // Map legacy 'General' to the official category code for KCET
      if (dto.examCode === 'KCET' && dto.category?.trim().toUpperCase() === 'GENERAL') {
        dto.category = 'GM';
      }
      const matchedCategory = allowed.find(category => category.toUpperCase() === dto.category!.trim().toUpperCase());
      if (!matchedCategory) {
        throw new DomainException(
          'VALIDATION_ERROR',
          `"${dto.category}" is not a valid category for ${dto.examCode}. Allowed: ${allowed.join(', ')}.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      dto.category = matchedCategory;
    }

    if (dto.examCode === 'COMEDK') {
      if (!dto.category) throw new DomainException('VALIDATION_ERROR', 'Select the COMEDK source seat type.', HttpStatus.BAD_REQUEST);
      if (dto.cutoffRound !== undefined && dto.cutoffYear === undefined) {
        throw new DomainException('VALIDATION_ERROR', 'Select a cutoff year when selecting a COMEDK round.', HttpStatus.BAD_REQUEST);
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

  private applyFilters(results: RankedCollegeResult[], filters?: PredictorFiltersDto, examCode: SupportedExam = 'KCET'): RankedCollegeResult[] {
    if (!filters) return results;
    return results.filter(r => {
      if (filters.collegeType) {
        const targetType = filters.collegeType.trim().toLowerCase();
        const collegeType = (r.collegeType ?? '').trim().toLowerCase();
        if (targetType && targetType !== 'all' && collegeType !== targetType) return false;
      }

      if (filters.city) {
        const targetCity = filters.city.trim().toLowerCase();
        if (!matchesKarnatakaLocation(r.city, targetCity)) return false;
      }

      if (filters.district) {
        const targetDistrict = filters.district.trim().toLowerCase();
        if (!matchesKarnatakaLocation(r.district ?? r.city, targetDistrict)) return false;
      }

      if (filters.course) {
        const matchesCourse = courseMatchesSelection(
          { name: r.courseName, degreeType: '', discipline: r.discipline },
          [filters.course],
          courseOptionsForExam(examCode),
        );
        if (!matchesCourse) return false;
      }

      if (filters.search) {
        const q = filters.search.trim().toLowerCase();
        const collegeName = (r.collegeName ?? '').trim().toLocaleLowerCase();
        const courseName = (r.courseName ?? '').trim().toLocaleLowerCase();
        const city = (r.city ?? '').trim().toLocaleLowerCase();
        const district = (r.district ?? '').trim().toLocaleLowerCase();
        const discipline = (r.discipline ?? '').trim().toLocaleLowerCase();
        const aliases = (r.aliases ?? []).map(alias => alias.trim().toLocaleLowerCase());
        const matchesSearch = collegeName.includes(q) || aliases.some(alias => alias.includes(q)) ||
          courseName.includes(q) || city.includes(q) || district.includes(q) || discipline.includes(q);
        if (!matchesSearch) return false;
      }

      if (filters.minFee !== undefined && (r.feePerYear ?? 0) < filters.minFee) return false;
      if (filters.maxFee !== undefined && (r.feePerYear ?? Infinity) > filters.maxFee) return false;
      if (filters.hostelRequired && !r.hostelAvailable) return false;
      if (filters.minPlacementAverage !== undefined && (r.placementAverage ?? 0) < filters.minPlacementAverage) return false;
      if (filters.maxNirfRank !== undefined && (r.nirfRank ?? Infinity) > filters.maxNirfRank) return false;
      return true;
    });
  }

  // ── Sorting ───────────────────────────────────────────────────────────────

  private sortResults(results: RankedCollegeResult[], sortBy: string): RankedCollegeResult[] {
    const getNirf = (r: number | null | undefined) => (typeof r === 'number' && !isNaN(r) && r > 0 ? r : 999999);
    const getFee = (f: number | null | undefined) => (typeof f === 'number' && !isNaN(f) && f > 0 ? f : 999999999);
    const getPlacement = (p: number | null | undefined) => (typeof p === 'number' && !isNaN(p) ? p : 0);
    return [...results].sort((a, b) => {
      if (sortBy === 'fee_asc') {
        const feeDiff = getFee(a.feePerYear) - getFee(b.feePerYear);
        if (feeDiff !== 0) return feeDiff;
        const nirfDiff = getNirf(a.nirfRank) - getNirf(b.nirfRank);
        if (nirfDiff !== 0) return nirfDiff;
        return (a.collegeName || '').localeCompare(b.collegeName || '');
      }

      if (sortBy === 'placement_desc') {
        const placeDiff = getPlacement(b.placementAverage) - getPlacement(a.placementAverage);
        if (placeDiff !== 0) return placeDiff;
        const nirfDiff = getNirf(a.nirfRank) - getNirf(b.nirfRank);
        if (nirfDiff !== 0) return nirfDiff;
        return (a.collegeName || '').localeCompare(b.collegeName || '');
      }

      // Default / 'nirf': NIRF Rank ascending (best NIRF first)
      const nirfDiff = getNirf(a.nirfRank) - getNirf(b.nirfRank);
      if (nirfDiff !== 0) return nirfDiff;
      return (a.collegeName || '').localeCompare(b.collegeName || '');
    });
  }

  // ── Smart insights (deterministic, rule-based) ───────────────────────────

  private buildInsights(results: RankedCollegeResult[]): string[] {
    const insights: string[] = [];

    if (results.length === 0) {
      insights.push('No colleges currently match your selections — try widening your course preferences or removing filters.');
      return insights;
    }

    const supported = results.filter(r => r.dataStatus === 'complete').length;
    if (supported > 0) insights.push(`${supported} options have verified historical cutoff evidence. These comparisons are not admission probabilities.`);

    const withRoi = results
      .filter(r => r.feePerYear && r.placementAverage)
      .map(r => ({ r, roiScore: r.placementAverage! / (r.feePerYear! / 100000) }))
      .sort((a, b) => b.roiScore - a.roiScore);
    if (withRoi.length > 0) {
      insights.push(`${withRoi[0].r.collegeName} offers strong ROI among your matches (placement-to-fee ratio).`);
    }

    return insights;
  }
}
