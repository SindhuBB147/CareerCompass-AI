import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prediction, PredictionDocument, ProbabilityBand } from '../models/prediction.model';
import { NOTIFICATION_EVENTS } from '../../notifications/events/notification.events';
import { UserRepository } from '../../users/repositories/user.repository';
import { CollegeRepository } from '../../colleges/repositories/college.repository';
import { CutoffService } from '../../cutoffs/cutoff.service';
import { DomainException } from '../../../common/filters/domain.exception';
import { HttpStatus } from '@nestjs/common';
import { computeTrendingClosingRank } from '../utils/prediction-math.util';
import { ScholarshipService } from '../../scholarships/services/scholarship.service';
import { estimateAnnualLivingCost } from '../../financial-planning/utils/living-cost.util';
import { sumScholarshipSavings } from '../../financial-planning/utils/scholarship-award.util';
import { ROI_DEFAULTS } from '../../financial-planning/utils/financial-config';

// ── Interfaces ─────────────────────────────────────────────────────────────────
export interface PredictionResult {
  probabilityBand: ProbabilityBand;
  probabilityPercent: number;
  rationale: { trendingClosingRank: number; studentRank: number; confidenceLevel: string };
  computedAt: Date;
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
  probabilityPercent: number;
}

// Favorability order, best first — used to detect a genuine improvement
// (not just any change) when a cached prediction is recomputed.
const BAND_RANK: Record<ProbabilityBand, number> = { Safe: 0, Moderate: 1, Ambitious: 2, Reach: 3 };

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class PredictionService {
  constructor(
    @InjectModel(Prediction.name) private readonly model: Model<PredictionDocument>,
    private readonly userRepo: UserRepository,
    private readonly collegeRepo: CollegeRepository,
    private readonly cutoffService: CutoffService,
    private readonly scholarshipService: ScholarshipService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Core prediction: computes admission probability using trend-weighted
   * cutoff modeling per the PRD's Business Logic section. Returns a cached
   * result if fresh; recomputes if expired or missing.
   */
  async getPrediction(userId: string, collegeId: string, courseId: string, examCode: string): Promise<PredictionResult> {
    // Check for a fresh cached prediction
    const cached = await this.model.findOne({ userId, collegeId, courseId, examCode }).exec();
    if (cached && cached.expiresAt && cached.expiresAt > new Date()) {
      // Non-null: this query only ever matches genuine admission-prediction
      // docs (examCode here is a real exam code, never the 'ROI' sentinel
      // getRoi() uses), which always populate these fields.
      return { probabilityBand: cached.probabilityBand!, probabilityPercent: cached.probabilityPercent!, rationale: cached.rationale!, computedAt: cached.computedAt };
    }

    // Fetch student rank
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });
    const examProfile = user.examProfiles.find((ep: any) => ep.examCode === examCode.toUpperCase());
    if (!examProfile) throw new DomainException('UNPROCESSABLE', `No exam profile found for ${examCode}.`, HttpStatus.UNPROCESSABLE_ENTITY);

    // Fetch cutoff trend
    const trend = await this.cutoffService.getTrend(collegeId, courseId, examCode.toUpperCase(), examProfile.categoryUsed ?? user.category ?? 'General');

    // Compute trending closing rank (weighted average, recent years weighted 2x)
    const trendingClosingRank = computeTrendingClosingRank(trend.map((t: any) => ({ year: t.year, closingRank: t.closingRank })));
    const studentRank = examProfile.rank;

    // Compute probability band
    const { band, percent, confidence } = this.computeProbability(studentRank, trendingClosingRank, trend.length);

    // Cache the result
    const prediction: Partial<Prediction> = {
      userId, collegeId, courseId, examCode: examCode.toUpperCase(),
      probabilityBand: band, probabilityPercent: percent,
      rationale: { trendingClosingRank, studentRank, confidenceLevel: confidence },
      computedAt: new Date(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day TTL
      modelVersion: 'v1.0',
    };

    await this.model.findOneAndUpdate(
      { userId, collegeId, courseId, examCode: examCode.toUpperCase() },
      prediction,
      { upsert: true },
    );

    // Best-effort improvement signal: only meaningful when a prior cached
    // prediction existed (not on first-ever compute) and the band genuinely
    // moved toward "Safe" (a cutoff shift, not just a re-run producing the
    // same result).
    if (cached?.probabilityBand && BAND_RANK[band] < BAND_RANK[cached.probabilityBand]) {
      const college = await this.collegeRepo.findById(collegeId);
      const course = college?.courses.find(c => c.courseId === courseId);
      if (college && course) {
        this.events.emit(NOTIFICATION_EVENTS.PREDICTION_IMPROVED, {
          userId, collegeName: college.name, courseName: course.name, examCode: examCode.toUpperCase(),
        });
      }
    }

    return { probabilityBand: band, probabilityPercent: percent, rationale: { trendingClosingRank, studentRank, confidenceLevel: confidence }, computedAt: prediction.computedAt! };
  }

  /** Batch predictions for all items in the user's shortlist. */
  async getShortlistPredictions(userId: string): Promise<PredictionResult[]> {
    // Excludes ROI-only cache docs (examCode: 'ROI', see getRoi()) — those
    // aren't shortlist entries and don't populate these fields.
    const predictions = await this.model.find({ userId, examCode: { $ne: 'ROI' } }).sort({ probabilityPercent: -1 }).exec();
    return predictions.map(p => ({
      probabilityBand: p.probabilityBand!, probabilityPercent: p.probabilityPercent!,
      rationale: p.rationale!, computedAt: p.computedAt,
    }));
  }

  /**
   * Choice-filling optimizer: ranks the user's shortlisted colleges
   * by a composite score of probability × preference weight, mixing
   * Safe/Moderate/Ambitious/Reach per the student's risk appetite.
   */
  async optimizeChoiceFilling(userId: string, examCode: string, riskAppetite: string): Promise<ChoiceFillingEntry[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });

    const predictions = await this.model.find({ userId, examCode: examCode.toUpperCase() }).exec();
    if (predictions.length === 0) throw new DomainException('UNPROCESSABLE', 'No predictions available. Shortlist colleges first.', HttpStatus.UNPROCESSABLE_ENTITY);

    // Sort by composite score: probability + risk-appetite weighting
    const weightMultiplier = riskAppetite === 'aggressive' ? 0.6 : riskAppetite === 'conservative' ? 1.4 : 1.0;

    const ranked = predictions
      // examCode filter above always selects genuine admission-prediction
      // docs (never the 'ROI' sentinel), so these fields are always populated.
      .map(p => ({
        collegeId: p.collegeId, courseId: p.courseId, band: p.probabilityBand!,
        probabilityPercent: p.probabilityPercent!,
        score: p.probabilityPercent! * weightMultiplier,
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry, i) => ({
        priority: i + 1,
        collegeId: entry.collegeId, courseId: entry.courseId,
        band: entry.band, probabilityPercent: entry.probabilityPercent,
      }));

    return ranked;
  }

  /**
   * ROI: total investment (tuition + living cost, net of scholarship
   * savings) vs. projected salary, payback period, and a career-growth-
   * adjusted ROI%. Cached for 14 days like getPrediction(), using a
   * sentinel examCode of 'ROI' so cache docs never collide with (or leak
   * into) real admission-prediction queries — see getShortlistPredictions()
   * and optimizeChoiceFilling(), which explicitly exclude/never match it.
   */
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

    // ROI assumes away-from-home (hosteller) living cost; a future param
    // could let the caller vary this by accommodation type.
    const livingCost = estimateAnnualLivingCost(college.city, true) * durationYears;
    const totalInvestment = tuitionAndFees + livingCost;

    const matches = await this.scholarshipService.getMatched(userId);
    const { totalEstimatedSavings: scholarshipSavings } = sumScholarshipSavings(
      matches.map((s: any) => ({ name: s.name, awardAmount: s.awardAmount })),
      tuitionAndFees,
    );

    const netCost = Math.max(0, totalInvestment - scholarshipSavings);

    const latestPlacement = [...college.placementSummary].sort((a: any, b: any) => b.year - a.year)[0];
    // placementSummary packages are stored in LPA — convert to rupees.
    const projectedPackageAnnual = (latestPlacement?.medianPackage ?? 5) * 100000;
    const highestPackageAnnual = (latestPlacement?.highestPackage ?? projectedPackageAnnual / 100000) * 100000;
    const placementPercentage = latestPlacement?.placementPercentage ?? null;

    const paybackYears = projectedPackageAnnual > 0
      ? Math.round((netCost / projectedPackageAnnual) * 100) / 100
      : 0;

    // 10-year cumulative earnings at an 8% CAGR salary-growth assumption
    // (closed-form geometric series), compared against net cost.
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

  /** Placement estimate: range-based, never a single number. */
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
      packageRange: [Math.min(...packages), Math.max(...packages) * 2], // Upper bound: assume top placement is ~2x median
    };
  }

  // ── Internal computation methods ─────────────────────────────────────────────

  private computeProbability(
    studentRank: number,
    trendingClosingRank: number,
    dataPoints: number,
  ): { band: ProbabilityBand; percent: number; confidence: string } {
    if (trendingClosingRank === 0) {
      return { band: 'Reach', percent: 0, confidence: 'low' };
    }

    // Ratio: < 1 means student rank is better than trend (lower = better)
    const ratio = studentRank / trendingClosingRank;

    let band: ProbabilityBand;
    let percent: number;

    if (ratio <= 0.7) {
      band = 'Safe'; percent = Math.min(98, 85 + (0.7 - ratio) * 40);
    } else if (ratio <= 0.95) {
      band = 'Moderate'; percent = 50 + ((0.95 - ratio) / 0.25) * 35;
    } else if (ratio <= 1.15) {
      band = 'Ambitious'; percent = 15 + ((1.15 - ratio) / 0.2) * 35;
    } else {
      band = 'Reach'; percent = Math.max(2, 15 - (ratio - 1.15) * 30);
    }

    percent = Math.round(Math.min(98, Math.max(2, percent)));

    const confidence = dataPoints >= 3 ? 'high' : dataPoints >= 2 ? 'medium' : 'low';

    return { band, percent, confidence };
  }
}
