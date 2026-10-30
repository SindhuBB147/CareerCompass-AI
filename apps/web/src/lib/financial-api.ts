// Typed client for the Financial Planning module — loan calculator, fee
// breakdown, hostel/living cost, dashboard, and comparison. Mirrors
// lib/scholarships-api.ts's conventions (thin apiClient wrappers, types
// re-declared here rather than shared with the backend).

import { apiClient } from './api-client';

// ── Loan ─────────────────────────────────────────────────────────────────

export interface LoanCalculatorRequest {
  loanAmount: number;
  interestRate: number;
  tenureYears: number;
  moratoriumMonths?: number;
  processingFeePercent?: number;
  processingFeeCap?: number;
  includeMonthlySchedule?: boolean;
}

export interface YearlyEmiGroup {
  year: number;
  openingBalance: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  closingBalance: number;
}

export interface MonthlyEmiEntry {
  month: number;
  emi: number;
  principalPaid: number;
  interestPaid: number;
  balanceRemaining: number;
}

export interface AmortizationResult {
  principal: number;
  interestRate: number;
  tenureYears: number;
  moratoriumMonths: number;
  moratoriumInterestAccrued: number;
  monthlyEmi: number;
  totalInterest: number;
  totalPayment: number;
  processingFeeAmount: number;
  totalCostOfLoan: number;
  yearlySchedule: YearlyEmiGroup[];
  monthlySchedule?: MonthlyEmiEntry[];
}

export interface LoanOfferInput {
  label: string;
  loanAmount: number;
  interestRate: number;
  tenureYears: number;
  moratoriumMonths?: number;
  processingFeePercent?: number;
  processingFeeCap?: number;
}

export interface LoanOfferComparisonResult {
  label: string;
  monthlyEmi: number;
  totalInterest: number;
  totalPayment: number;
  processingFeeAmount: number;
  totalCostOfLoan: number;
}

export interface LoanOfferComparison {
  offers: LoanOfferComparisonResult[];
  cheapestLabel: string;
}

// ── Fee breakdown ────────────────────────────────────────────────────────

export type AccommodationType = 'hostel' | 'pg' | 'apartment_shared' | 'day_scholar';
export type TransportPreference = 'none' | 'public' | 'two_wheeler';

export interface FeeBreakdownRequest {
  collegeId: string;
  courseId: string;
  hostelRequired: boolean;
  accommodationType?: AccommodationType;
  transportPreference?: TransportPreference;
  includeLaptop?: boolean;
}

export type FeeLineItemSource = 'db' | 'estimated';

export interface FeeLineItem {
  label: string;
  amount: number;
  source: FeeLineItemSource;
  recurring: boolean;
}

export interface YearlyFeeBreakdown {
  year: number;
  lineItems: FeeLineItem[];
  total: number;
}

export interface SemesterFeeBreakdown {
  year: number;
  semester: 1 | 2;
  lineItems: FeeLineItem[];
  total: number;
}

export interface ProgramFeeBreakdown {
  durationYears: number;
  yearly: YearlyFeeBreakdown[];
  semesterWise: SemesterFeeBreakdown[];
  totalProgramCost: number;
  totalProgramCostWithLaptop: number;
}

// ── Hostel & living cost ────────────────────────────────────────────────

export interface HostelLivingRequest {
  collegeId?: string;
  city?: string;
  accommodationType: AccommodationType;
  transportPreference?: TransportPreference;
}

export interface DbHostelInfo {
  boysHostel: boolean;
  girlsHostel: boolean;
  capacity: number;
  roomTypes: string[];
  messDetails: string;
  amenities: string[];
  hostelFeePerYear: number;
  messFeePerYear: number;
}

export interface LivingCostBreakdown {
  accommodationType: AccommodationType;
  cityTier: 'tier1' | 'tier2' | 'tier3';
  rentOrHostelMonthly: number;
  electricityMonthly: number;
  internetMonthly: number;
  laundryMonthly: number;
  foodMonthly: number;
  personalMonthly: number;
  transportMonthly: number;
  medicalMiscMonthly: number;
  totalMonthly: number;
  totalAnnual: number;
}

export interface HostelLivingResult {
  dbHostelInfo: DbHostelInfo | null;
  estimate: LivingCostBreakdown;
}

// ── Dashboard ────────────────────────────────────────────────────────────

export interface FinancialDashboardRequest {
  collegeId: string;
  courseId: string;
  hostelRequired: boolean;
  accommodationType?: AccommodationType;
  transportPreference?: TransportPreference;
  includeLaptop?: boolean;
  familyContribution?: number;
  currentSavings?: number;
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

export interface ScholarshipSavingsLine {
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
  estimatedSavings: number;
}

export interface ScholarshipSavingsResult {
  scholarships: ScholarshipSavingsLine[];
  totalEstimatedSavings: number;
}

export interface FinancialDashboardResult {
  collegeId: string;
  courseId: string;
  feeBreakdown: ProgramFeeBreakdown;
  hostelLiving: HostelLivingResult | null;
  scholarshipSavings: ScholarshipSavingsResult;
  roi: RoiResult;
  expectedSalaryAfterGraduation: number;
  loanAmountNeeded: number;
  estimatedEmi: number;
  netFinancialBurden: number;
}

// ── Comparison ───────────────────────────────────────────────────────────

export interface CollegeCourseId {
  collegeId: string;
  courseId: string;
}

export interface FinancialComparisonRequest {
  collegeCourseIds: CollegeCourseId[];
  hostelRequired: boolean;
}

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

export const financialApi = {
  calculateLoan: (body: LoanCalculatorRequest) =>
    apiClient.post<AmortizationResult>('/financial-planning/loan-calculator', body),
  compareLoanOffers: (offers: LoanOfferInput[]) =>
    apiClient.post<LoanOfferComparison>('/financial-planning/loan-calculator/compare', { offers }),
  getFeeBreakdown: (body: FeeBreakdownRequest) =>
    apiClient.post<ProgramFeeBreakdown>('/financial-planning/fee-breakdown', body),
  getHostelLiving: (body: HostelLivingRequest) =>
    apiClient.post<HostelLivingResult>('/financial-planning/hostel-living', body),
  getDashboard: (body: FinancialDashboardRequest, token: string) =>
    apiClient.post<FinancialDashboardResult>('/financial-planning/dashboard', body, token),
  getComparison: (body: FinancialComparisonRequest, token: string) =>
    apiClient.post<FinancialComparisonResult>('/financial-planning/comparison', body, token),
};
