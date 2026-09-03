import { Injectable, NotFoundException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AiServiceClient } from '../../../common/ai-client/ai-service.client';
import { Prediction, PredictionDocument, ProbabilityBand } from '../models/prediction.model';
import { NOTIFICATION_EVENTS } from '../../notifications/events/notification.events';
import { UserRepository } from '../../users/repositories/user.repository';
import { CollegeRepository } from '../../colleges/repositories/college.repository';
import { CutoffService } from '../../cutoffs/cutoff.service';
import { DomainException } from '../../../common/filters/domain.exception';
import {
  computeTrendingClosingRank,
  classifyPortfolio,
  legacyBandFromClassification,
  recommendationScoreFromRatio,
  confidenceFromDataPoints,
  PortfolioClassification,
  RiskPreferenceMode,
  PORTFOLIO_RISK_MODES,
} from '../utils/prediction-math.util';
import { ScholarshipService } from '../../scholarships/services/scholarship.service';
import { estimateAnnualLivingCost } from '../../financial-planning/utils/living-cost.util';
import { sumScholarshipSavings } from '../../financial-planning/utils/scholarship-award.util';
import { ROI_DEFAULTS } from '../../financial-planning/utils/financial-config';

// ── Interfaces ─────────────────────────────────────────────────────────────────
export interface PredictionResult {
  recommendationFitScore: number;
  probabilityBand: ProbabilityBand;
  probabilityPercent: number; // Deprecated alias for recommendationFitScore
  portfolioClassification?: PortfolioClassification;
  predictedClosingRank: number | null;
  forecastStatus: 'AVAILABLE' | 'FORECAST_NOT_AVAILABLE';
  rationale: { trendingClosingRank: number; studentRank: number; confidenceLevel: string };
  computedAt: Date;
}

export interface HistoricalEligibilityDto {
  exam: string;
  rank: number;
  category: string;
  quota?: string | null;
  course?: string;
  collegeCode?: string;
  collegeId?: string;
}

export interface HistoricalEligibilityResult {
  status: 'HISTORICALLY_ELIGIBLE' | 'HISTORICALLY_NOT_ELIGIBLE' | 'INSUFFICIENT_DATA';
  exam: string;
  studentRank: number;
  historicalClosingRank: number | null;
  historicalOpeningRank: number | null;
  year: number | null;
  round: number | string | null;
  category: string;
  quota: string | null;
  college: string;
  course: string;
  rankMargin: number | null;
  portfolioClassification: PortfolioClassification;
  dataAvailability: {
    totalHistoricalYears: number;
    yearsAvailable: number[];
    isExactCategoryMatch: boolean;
  };
}

export interface RoiResult {
  totalInvestment: number;
  tuitionAndFees: number;
  livingCost: number;
  scholarshipSavings: number;
  netCost: number;
  projectedPackageAnnual: number;
  highestPackageAnnual: number;
  placementPercentage: number | null;
  paybackYears: number;
  roiPercent: number;
  durationYears: number;
}

export interface PlacementResult {
  placementPercentRange: [number, number];
  packageRange: [number, number];
}

export interface ChoiceFillingEntry {
  priority: number;
  collegeId: string;
  courseId: string;
  band: ProbabilityBand;
  portfolioClassification: PortfolioClassification;
  recommendationFitScore: number;
  probabilityPercent: number; // Deprecated alias for recommendationFitScore
  score: number;
}

export interface ChoiceOptimizerResult {
  riskMode: RiskPreferenceMode;
  targetPortfolioMix: { safePercentage: number; targetPercentage: number; dreamPercentage: number };
  safeChoices: ChoiceFillingEntry[];
  targetChoices: ChoiceFillingEntry[];
  dreamChoices: ChoiceFillingEntry[];
  recommendedOrdering: ChoiceFillingEntry[];
}

const BAND_RANK: Record<ProbabilityBand, number> = { Safe: 0, Moderate: 1, Ambitious: 2, Reach: 3 };

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);

  constructor(
    @InjectModel(Prediction.name) private readonly model: Model<PredictionDocument>,
    private readonly userRepo: UserRepository,
    private readonly collegeRepo: CollegeRepository,
    private readonly cutoffService: CutoffService,
    private readonly scholarshipService: ScholarshipService,
    private readonly events: EventEmitter2,
    private readonly aiServiceClient: AiServiceClient,
  ) {}

  /**
   * Evaluates deterministic historical cutoff eligibility for a student rank.
   */
  async getHistoricalEligibility(dto: HistoricalEligibilityDto): Promise<HistoricalEligibilityResult> {
    const examCode = dto.exam ? dto.exam.toUpperCase() : 'COMEDK';
    const category = dto.category ? dto.category.toUpperCase() : 'GM';
    const targetCollegeId = dto.collegeId || dto.collegeCode || '';
    const targetCourseId = dto.course || '';

    const cutoffs = await this.cutoffService.getTrend(targetCollegeId, targetCourseId, examCode, category, dto.quota);

    if (!cutoffs || cutoffs.length === 0) {
      return {
        status: 'INSUFFICIENT_DATA',
        exam: examCode,
        studentRank: dto.rank,
        historicalClosingRank: null,
        historicalOpeningRank: null,
        year: null,
        round: null,
        category,
        quota: dto.quota ?? null,
        college: targetCollegeId,
        course: targetCourseId,
        rankMargin: null,
        portfolioClassification: 'INSUFFICIENT_DATA',
        dataAvailability: { totalHistoricalYears: 0, yearsAvailable: [], isExactCategoryMatch: false },
      };
    }

    const latest = [...cutoffs].sort((a, b) => (b.year !== a.year ? b.year - a.year : String(b.round).localeCompare(String(a.round))))[0];
    const historicalClosingRank = latest.closingRank;
    const isEligible = dto.rank <= historicalClosingRank;
    const rankMargin = historicalClosingRank - dto.rank;
    const portfolioClassification = classifyPortfolio(dto.rank, historicalClosingRank);
    const yearsAvailable = Array.from(new Set(cutoffs.map(c => c.year))).sort((a, b) => a - b);

    return {
      status: isEligible ? 'HISTORICALLY_ELIGIBLE' : 'HISTORICALLY_NOT_ELIGIBLE',
      exam: examCode,
      studentRank: dto.rank,
      historicalClosingRank,
      historicalOpeningRank: latest.openingRank ?? null,
      year: latest.year,
      round: latest.round,
      category,
      quota: dto.quota ?? null,
      college: latest.collegeName || latest.collegeCode || latest.collegeId,
      course: latest.courseName || latest.courseCode || latest.courseId,
      rankMargin,
      portfolioClassification,
      dataAvailability: {
        totalHistoricalYears: yearsAvailable.length,
        yearsAvailable,
        isExactCategoryMatch: true,
      },
    };
  }

  /**
   * Computes rank cutoff assessment & recommendation fit.
   * NOTE: This returns a deterministic score and portfolio band, NOT an ML admission probability.
   */
  async getPrediction(userId: string, collegeId: string, courseId: string, examCode: string): Promise<PredictionResult> {
    const cached = await this.model.findOne({ userId, collegeId, courseId, examCode }).exec();
    if (cached && cached.expiresAt && cached.expiresAt > new Date()) {
      const fitScore = cached.probabilityPercent!;
      return {
        recommendationFitScore: fitScore,
        probabilityBand: cached.probabilityBand!,
        probabilityPercent: fitScore,
        portfolioClassification: cached.portfolioClassification as any,
        predictedClosingRank: (cached as any).predictedClosingRank ?? null,
        forecastStatus: ((cached as any).forecastStatus ?? 'FORECAST_NOT_AVAILABLE') as any,
        rationale: cached.rationale!,
        computedAt: cached.computedAt,
      };
    }

    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });
    const examProfile = user.examProfiles.find((ep: any) => ep.examCode === examCode.toUpperCase());
    if (!examProfile) throw new DomainException('UNPROCESSABLE', `No exam profile found for ${examCode}.`, HttpStatus.UNPROCESSABLE_ENTITY);

    const trend = await this.cutoffService.getTrend(collegeId, courseId, examCode.toUpperCase(), examProfile.categoryUsed ?? user.category ?? 'General');

    const trendingClosingRank = computeTrendingClosingRank(trend.map((t: any) => ({ year: t.year, closingRank: t.closingRank })));
    const studentRank = examProfile.rank;

    const { band, percent, confidence, portfolioClassification } = this.computeProbability(studentRank, trendingClosingRank, trend.length);

    const cleanExam = examCode.toUpperCase();
    const uniqueYears = Array.from(new Set(trend.map((t: any) => t.year)));
    const hasLegitimateForecastData = uniqueYears.length >= 4;

    let predictedClosingRank: number | null = null;
    let forecastStatus: 'AVAILABLE' | 'FORECAST_NOT_AVAILABLE' = 'FORECAST_NOT_AVAILABLE';

    const mostRecent = [...trend].sort((a: any, b: any) => b.year - a.year)[0];

    if (hasLegitimateForecastData && (cleanExam === 'KCET' || cleanExam === 'COMEDK')) {
      try {
        const college = await this.collegeRepo.findById(collegeId);
        const course = college?.courses.find(c => c.courseId === courseId);
        
        const mlResponse = await this.aiServiceClient.predictML({
          exam: cleanExam,
          year: (mostRecent?.year ?? 2025) + 1,
          round: mostRecent?.round ?? 1,
          college_code: mostRecent?.collegeCode || collegeId,
          course_code: mostRecent?.courseCode || courseId,
          category: examProfile.categoryUsed ?? user.category ?? 'General',
          quota: mostRecent?.quota ?? null,
          college_type: college?.collegeType ?? 'Private',
        });
        if (mlResponse && mlResponse.success) {
          predictedClosingRank = mlResponse.predictedClosingRank;
          forecastStatus = 'AVAILABLE';
        }
      } catch (error) {
        this.logger.error(`Failed to get ML prediction: ${(error as any).message}`);
      }
    }

    const prediction: Partial<Prediction> = {
      userId, collegeId, courseId, examCode: cleanExam,
      probabilityBand: band, probabilityPercent: percent,
      portfolioClassification,
      predictedClosingRank,
      forecastStatus,
      rationale: { trendingClosingRank, studentRank, confidenceLevel: confidence },
      computedAt: new Date(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      modelVersion: 'v2.0-p1-recommendation',
    };

    await this.model.findOneAndUpdate(
      { userId, collegeId, courseId, examCode: cleanExam },
      prediction,
      { upsert: true },
    );

    if (cached?.probabilityBand && BAND_RANK[band] < BAND_RANK[cached.probabilityBand]) {
      const college = await this.collegeRepo.findById(collegeId);
      const course = college?.courses.find(c => c.courseId === courseId);
      if (college && course) {
        this.events.emit(NOTIFICATION_EVENTS.PREDICTION_IMPROVED, {
          userId, collegeName: college.name, courseName: course.name, examCode: cleanExam,
        });
      }
    }

    return {
      recommendationFitScore: percent,
      probabilityBand: band,
      probabilityPercent: percent,
      portfolioClassification,
      predictedClosingRank,
      forecastStatus,
      rationale: { trendingClosingRank, studentRank, confidenceLevel: confidence },
      computedAt: prediction.computedAt!,
    };
  }

  async getShortlistPredictions(userId: string): Promise<PredictionResult[]> {
    const predictions = await this.model.find({ userId, examCode: { $ne: 'ROI' } }).sort({ probabilityPercent: -1 }).exec();
    return predictions.map(p => ({
      recommendationFitScore: p.probabilityPercent!,
      probabilityBand: p.probabilityBand!,
      probabilityPercent: p.probabilityPercent!,
      portfolioClassification: (p as any).portfolioClassification,
      predictedClosingRank: (p as any).predictedClosingRank ?? null,
      forecastStatus: ((p as any).forecastStatus ?? 'FORECAST_NOT_AVAILABLE') as any,
      rationale: p.rationale!,
      computedAt: p.computedAt,
    }));
  }

  /**
   * Constrained Choice-Filling Optimizer:
   * Groups options into Safe, Target, and Dream portfolios and sorts them based on risk preference modes.
   */
  async optimizeChoiceFilling(userId: string, examCode: string, riskAppetite: string): Promise<ChoiceFillingEntry[] & ChoiceOptimizerResult> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });

    const predictions = await this.model.find({ userId, examCode: examCode.toUpperCase() }).exec();
    if (predictions.length === 0) throw new DomainException('UNPROCESSABLE', 'No predictions available. Shortlist colleges first.', HttpStatus.UNPROCESSABLE_ENTITY);

    const mode: RiskPreferenceMode = (riskAppetite === 'aggressive' || riskAppetite === 'conservative') ? riskAppetite : 'balanced';
    const targetMix = PORTFOLIO_RISK_MODES[mode];
    const weightMultiplier = mode === 'aggressive' ? 0.6 : mode === 'conservative' ? 1.4 : 1.0;

    const items = predictions.map(p => {
      const studentRank = p.rationale?.studentRank ?? 0;
      const trendRank = p.rationale?.trendingClosingRank ?? 0;
      const classification = classifyPortfolio(studentRank, trendRank);
      return {
        collegeId: p.collegeId,
        courseId: p.courseId,
        band: p.probabilityBand!,
        portfolioClassification: classification,
        recommendationFitScore: p.probabilityPercent!,
        probabilityPercent: p.probabilityPercent!,
        score: p.probabilityPercent! * weightMultiplier,
      };
    });

    const safeChoices = items.filter(i => i.portfolioClassification === 'SAFE');
    const targetChoices = items.filter(i => i.portfolioClassification === 'TARGET');
    const dreamChoices = items.filter(i => i.portfolioClassification === 'DREAM' || i.portfolioClassification === 'OUTSIDE_HISTORICAL_RANGE');

    // Monotonic choice ordering: Dream choices first (ambitious stretch), then Target, then Safe anchors at the bottom
    const recommendedOrdering = [
      ...dreamChoices.sort((a, b) => b.score - a.score),
      ...targetChoices.sort((a, b) => b.score - a.score),
      ...safeChoices.sort((a, b) => b.score - a.score),
    ].map((entry, i) => ({
      priority: i + 1,
      collegeId: entry.collegeId,
      courseId: entry.courseId,
      band: entry.band,
      portfolioClassification: entry.portfolioClassification,
      recommendationFitScore: entry.recommendationFitScore,
      probabilityPercent: entry.probabilityPercent,
      score: entry.score,
    }));

    // Attach structured portfolio properties while keeping array compatibility for existing API contracts
    const result: any = recommendedOrdering;
    result.riskMode = mode;
    result.targetPortfolioMix = targetMix;
    result.safeChoices = safeChoices.map((e, i) => ({ priority: i + 1, ...e }));
    result.targetChoices = targetChoices.map((e, i) => ({ priority: i + 1, ...e }));
    result.dreamChoices = dreamChoices.map((e, i) => ({ priority: i + 1, ...e }));
    result.recommendedOrdering = recommendedOrdering;

    return result;
  }

  async getRoi(userId: string, collegeId: string, courseId: string): Promise<RoiResult> {
    const cached = await this.model.findOne({ userId, collegeId, courseId, examCode: 'ROI' }).exec();
    if (cached?.roiEstimate && cached.expiresAt && cached.expiresAt > new Date()) {
      return cached.roiEstimate as unknown as RoiResult;
    }

    const college = await this.collegeRepo.findById(collegeId);
    if (!college) throw new NotFoundException({ code: 'NOT_FOUND', message: 'College not found.' });

    const course = college.courses.find((c: any) => c.courseId === courseId.toUpperCase());
    if (!course) throw new DomainException('NOT_FOUND', 'Course not found.', HttpStatus.NOT_FOUND);

    const durationYears = course.durationYears ?? 4;
    const feePerYear = course.feePerYear ?? (college as any).feeBreakdown?.totalAnnualFee ?? 0;
    const tuitionAndFees = feePerYear * durationYears;

    const livingCost = estimateAnnualLivingCost(college.city, true) * durationYears;
    const totalInvestment = tuitionAndFees + livingCost;

    const matches = await this.scholarshipService.getMatched(userId);
    const { totalEstimatedSavings: scholarshipSavings } = sumScholarshipSavings(
      matches.map((s: any) => ({ name: s.name, awardAmount: s.awardAmount })),
      tuitionAndFees,
    );

    const netCost = Math.max(0, totalInvestment - scholarshipSavings);

    const latestPlacement = [...college.placementSummary].sort((a: any, b: any) => b.year - a.year)[0];
    const projectedPackageAnnual = (latestPlacement?.medianPackage ?? 5) * 100000;
    const highestPackageAnnual = (latestPlacement?.highestPackage ?? projectedPackageAnnual / 100000) * 100000;
    const placementPercentage = latestPlacement?.placementPercentage ?? null;

    const paybackYears = projectedPackageAnnual > 0
      ? Math.round((netCost / projectedPackageAnnual) * 100) / 100
      : 0;

    const growthRate = ROI_DEFAULTS.salaryGrowthRatePct / 100;
    const horizon = ROI_DEFAULTS.horizonYears;
    const cumulativeEarnings = growthRate > 0
      ? projectedPackageAnnual * ((Math.pow(1 + growthRate, horizon) - 1) / growthRate)
      : projectedPackageAnnual * horizon;
    const roiPercent = netCost > 0 ? Math.round(((cumulativeEarnings - netCost) / netCost) * 100) : 0;

    const result: RoiResult = {
      totalInvestment: Math.round(totalInvestment),
      tuitionAndFees: Math.round(tuitionAndFees),
      livingCost: Math.round(livingCost),
      scholarshipSavings: Math.round(scholarshipSavings),
      netCost: Math.round(netCost),
      projectedPackageAnnual: Math.round(projectedPackageAnnual),
      highestPackageAnnual: Math.round(highestPackageAnnual),
      placementPercentage,
      paybackYears,
      roiPercent,
      durationYears,
    };

    await this.model.findOneAndUpdate(
      { userId, collegeId, courseId, examCode: 'ROI' },
      { userId, collegeId, courseId, examCode: 'ROI', roiEstimate: result, computedAt: new Date(), expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      { upsert: true },
    );

    return result;
  }

  async getPlacementEstimate(collegeId: string, courseId: string): Promise<PlacementResult> {
    const college = await this.collegeRepo.findById(collegeId);
    if (!college) throw new NotFoundException({ code: 'NOT_FOUND', message: 'College not found.' });

    const placements = college.placementSummary.sort((a: any, b: any) => b.year - a.year).slice(0, 3);
    if (placements.length === 0) {
      return { placementPercentRange: [0, 0], packageRange: [0, 0] };
    }

    const percents = placements.map((p: any) => p.placementPercentage);
    const packages = placements.map((p: any) => p.medianPackage);

    return {
      placementPercentRange: [Math.min(...percents), Math.max(...percents)],
      packageRange: [Math.min(...packages), Math.max(...packages) * 2],
    };
  }

  // ── Internal computation methods ─────────────────────────────────────────────

  private computeProbability(
    studentRank: number,
    trendingClosingRank: number,
    dataPoints: number,
  ): { band: ProbabilityBand; percent: number; confidence: string; portfolioClassification: PortfolioClassification } {
    if (trendingClosingRank === 0) {
      return { band: 'Reach', percent: 1, confidence: 'low', portfolioClassification: 'INSUFFICIENT_DATA' };
    }

    const portfolioClassification = classifyPortfolio(studentRank, trendingClosingRank);
    const band = legacyBandFromClassification(portfolioClassification);
    const ratio = studentRank / trendingClosingRank;
    const percent = recommendationScoreFromRatio(ratio);
    const confidence = confidenceFromDataPoints(dataPoints);

    return { band, percent, confidence, portfolioClassification };
  }
}
