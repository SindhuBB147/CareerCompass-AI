import type { ExamCode } from './constants';

export type ProbabilityLevel = 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';
export type PortfolioClassification = 'SAFE' | 'TARGET' | 'DREAM' | 'OUTSIDE_HISTORICAL_RANGE' | 'INSUFFICIENT_DATA';

export interface ScoreBreakdown {
  eligibility: number;
  branchMatch: number;
  location: number;
  budget: number;
  placement: number;
  collegeQuality: number;
  roi: number;
}

export interface CutoffProvenance {
  exam: string;
  year: number | null;
  round: number | string | null;
  category: string;
  quota: string | null;
  source: string;
}

export interface RankedCollegeResult {
  collegeId: string;
  collegeName: string;
  collegeImage?: string;
  nirfRank: number | null;
  discipline: string;
  courseId: string;
  courseName: string;
  recommendationFitScore: number; // Primary recommendation fit score (1-99)
  /** @deprecated Use recommendationFitScore instead. */
  probabilityPercent?: number;
  /** @deprecated Use portfolioClassification instead. */
  probabilityLevel?: ProbabilityLevel;
  portfolioClassification: PortfolioClassification;
  scoreBreakdown?: ScoreBreakdown;
  reasons?: string[];
  provenance?: CutoffProvenance;
  previousYearCutoff: number | null;
  expectedClosingRank: number | null;
  predictedClosingRank: number | null;
  forecastStatus: 'AVAILABLE' | 'FORECAST_NOT_AVAILABLE';
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

export interface PredictCollegesResponse {
  results: RankedCollegeResult[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
  insights: string[];
}

export interface PredictorFilters {
  collegeType?: string;
  city?: string;
  district?: string;
  minFee?: number;
  maxFee?: number;
  hostelRequired?: boolean;
  minPlacementAverage?: number;
  maxNirfRank?: number;
  minRecommendationFitScore?: number;
  /** @deprecated Use minRecommendationFitScore instead. */
  minProbabilityPercent?: number;
}

export interface PredictCollegesRequest {
  examCode: ExamCode;
  rank: number;
  category?: string;
  discipline?: string;
  courseSelections?: string[];
  horizontalReservations?: string[];
  filters?: PredictorFilters;
  sortBy?: 'nirf' | 'probability';
  page?: number;
  limit?: number;
}
