import type { ExamCode } from './constants';

export type ProbabilityLevel = 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';

export interface RankedCollegeResult {
  collegeId: string;
  collegeName: string;
  collegeImage?: string;
  nirfRank: number | null;
  discipline: string;
  courseId: string;
  courseName: string;
  probabilityPercent: number;
  probabilityLevel: ProbabilityLevel;
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
