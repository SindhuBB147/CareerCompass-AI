import { Injectable } from '@nestjs/common';
import { FeeBreakdownService } from './fee-breakdown.service';
import { HostelLivingService, HostelLivingResult } from './hostel-living.service';
import { ScholarshipSavingsService } from './scholarship-savings.service';
import { PredictionService, RoiResult } from '../../predictions/services/prediction.service';
import { CollegeService } from '../../colleges/services/college.service';
import { FinancialDashboardRequestDto } from '../dto/dashboard.dto';
import { FinancialComparisonRequestDto } from '../dto/comparison.dto';
import { ProgramFeeBreakdown } from '../utils/fee-breakdown.util';
import { ScholarshipSavingsResult } from '../utils/scholarship-award.util';
import { amortize } from '../utils/loan-amortization.util';
import { LOAN_DEFAULTS } from '../utils/financial-config';

const HOSTEL_LABELS = ['Hostel Fee', 'Mess Charges'];
const LIVING_LABELS = ['Living Expenses (Day Scholar)'];

export interface FinancialComparisonRow {
  collegeId: string;
  collegeName: string;
  courseId: string;
  courseName: string;
  totalFees: number;
  hostelCost: number;
  livingCost: number;
  totalCost: number;
  scholarshipSavings: number;
  placementPercentage: number | null;
  avgPackage: number;
  highestPackage: number;
  roiPercent: number;
  paybackYears: number;
  loanAmountNeeded: number;
}

export interface FinancialComparisonResult {
  rows: FinancialComparisonRow[];
}

export interface FinancialDashboardResult {
  collegeId: string;
  courseId: string;
  feeBreakdown: ProgramFeeBreakdown;
  /** Present only when hostelRequired is false — the living-cost alternative to hostel line items. */
  hostelLiving: HostelLivingResult | null;
  scholarshipSavings: ScholarshipSavingsResult;
  roi: RoiResult;
  expectedSalaryAfterGraduation: number;
  loanAmountNeeded: number;
  estimatedEmi: number;
  /** totalProgramCost − scholarshipSavings − familyContribution (deliberately excludes currentSavings — see loanAmountNeeded for that). */
  netFinancialBurden: number;
}

@Injectable()
export class FinancialDashboardService {
  constructor(
    private readonly feeBreakdownService: FeeBreakdownService,
    private readonly hostelLivingService: HostelLivingService,
    private readonly scholarshipSavingsService: ScholarshipSavingsService,
    private readonly predictionService: PredictionService,
    private readonly collegeService: CollegeService,
  ) {}

  async getDashboard(userId: string | undefined, dto: FinancialDashboardRequestDto): Promise<FinancialDashboardResult> {
    const feeBreakdown = await this.feeBreakdownService.getFeeBreakdown({
      collegeId: dto.collegeId, courseId: dto.courseId, hostelRequired: dto.hostelRequired,
      accommodationType: dto.accommodationType, transportPreference: dto.transportPreference, includeLaptop: dto.includeLaptop,
    });

    const hostelLiving = dto.hostelRequired ? null : await this.hostelLivingService.getHostelLivingEstimate({
      collegeId: dto.collegeId, accommodationType: dto.accommodationType ?? 'day_scholar', transportPreference: dto.transportPreference,
    });

    // Academic-fee-only total (excludes hostel/mess/living/one-time items) —
    // the base percentage scholarships apply against, matching
    // sumScholarshipSavings' convention elsewhere in this module.
    const academicFeeTotal = feeBreakdown.yearly.reduce(
      (sum, y) => sum + y.lineItems
        .filter(li => ['Tuition Fee', 'Development Fee', 'Laboratory Fee', 'Library Fee', 'Examination Fee'].includes(li.label))
        .reduce((s, li) => s + li.amount, 0),
      0,
    );
    const scholarshipSavings = await this.scholarshipSavingsService.getEstimatedSavings(userId, academicFeeTotal);

    const roi = userId
      ? await this.predictionService.getRoi(userId, dto.collegeId, dto.courseId)
      : this.zeroRoi();

    const familyContribution = dto.familyContribution ?? 0;
    const currentSavings = dto.currentSavings ?? 0;

    const loanAmountNeeded = Math.max(
      0,
      feeBreakdown.totalProgramCost - scholarshipSavings.totalEstimatedSavings - familyContribution - currentSavings,
    );
    const estimatedEmi = loanAmountNeeded > 0
      ? amortize({
          loanAmount: loanAmountNeeded,
          interestRate: LOAN_DEFAULTS.defaultInterestRate,
          tenureYears: LOAN_DEFAULTS.defaultTenureYears,
        }).monthlyEmi
      : 0;

    const netFinancialBurden = Math.max(
      0,
      feeBreakdown.totalProgramCost - scholarshipSavings.totalEstimatedSavings - familyContribution,
    );

    return {
      collegeId: dto.collegeId,
      courseId: dto.courseId,
      feeBreakdown,
      hostelLiving,
      scholarshipSavings,
      roi,
      expectedSalaryAfterGraduation: roi.projectedPackageAnnual,
      loanAmountNeeded,
      estimatedEmi,
      netFinancialBurden,
    };
  }

  /**
   * Up to 4 colleges, financial lens. Reuses CollegeService.compare() only
   * for its fetch-by-ids-with-404-handling behavior (never re-implements
   * college fetching), then composes each requested college+course pair
   * through the exact same getDashboard() this class already uses for the
   * single-college view — no duplicated cost math.
   */
  async getComparison(userId: string | undefined, dto: FinancialComparisonRequestDto): Promise<FinancialComparisonResult> {
    const uniqueCollegeIds = Array.from(new Set(dto.collegeCourseIds.map(c => c.collegeId)));
    const colleges = await this.collegeService.compare({ collegeIds: uniqueCollegeIds } as any);
    const collegeById = new Map(colleges.map(c => [String((c as any).id ?? (c as any)._id), c]));

    const rows = await Promise.all(dto.collegeCourseIds.map(async ({ collegeId, courseId }) => {
      const college = collegeById.get(collegeId) as any;
      const course = college?.courses.find((c: any) => c.courseId === courseId.toUpperCase());

      const dashboard = await this.getDashboard(userId, { collegeId, courseId, hostelRequired: dto.hostelRequired } as FinancialDashboardRequestDto);
      const hostelCost = this.sumLineItemsByLabel(dashboard.feeBreakdown, HOSTEL_LABELS);
      const livingCost = dto.hostelRequired
        ? 0
        : this.sumLineItemsByLabel(dashboard.feeBreakdown, LIVING_LABELS);
      const totalFees = dashboard.feeBreakdown.totalProgramCost - hostelCost - livingCost;

      const row: FinancialComparisonRow = {
        collegeId, collegeName: college?.name ?? collegeId,
        courseId, courseName: course?.name ?? courseId,
        totalFees, hostelCost, livingCost,
        totalCost: dashboard.feeBreakdown.totalProgramCost,
        scholarshipSavings: dashboard.scholarshipSavings.totalEstimatedSavings,
        placementPercentage: dashboard.roi.placementPercentage,
        avgPackage: dashboard.roi.projectedPackageAnnual,
        highestPackage: dashboard.roi.highestPackageAnnual,
        roiPercent: dashboard.roi.roiPercent,
        paybackYears: dashboard.roi.paybackYears,
        loanAmountNeeded: dashboard.loanAmountNeeded,
      };
      return row;
    }));

    return { rows };
  }

  private sumLineItemsByLabel(feeBreakdown: ProgramFeeBreakdown, labels: string[]): number {
    return feeBreakdown.yearly.reduce(
      (sum, y) => sum + y.lineItems.filter(li => labels.includes(li.label)).reduce((s, li) => s + li.amount, 0),
      0,
    );
  }

  private zeroRoi(): RoiResult {
    return {
      totalInvestment: 0, tuitionAndFees: 0, livingCost: 0, scholarshipSavings: 0, netCost: 0,
      projectedPackageAnnual: 0, highestPackageAnnual: 0, placementPercentage: null,
      paybackYears: 0, roiPercent: 0, durationYears: 0,
    };
  }
}
