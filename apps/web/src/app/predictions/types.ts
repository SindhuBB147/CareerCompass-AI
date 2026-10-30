import type { ExamCode } from './constants';

export type ProbabilityLevel = string;

export interface RankedCollegeResult {
  collegeId: string;
  collegeName: string;
  collegeImage?: string;
  nirfRank: number | null;
  discipline: string;
  courseId: string;
  courseName: string;
  probabilityPercent: number | null;
  probabilityLevel: ProbabilityLevel;
  previousYearCutoff: number | null;
  expectedClosingRank: number | null;
  feePerYear: number | null;
  placementAverage: number | null;
  city: string;
  district?: string;
  aliases?: string[];
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
  historicalCutoffs: Array<{
    year: number;
    round: number;
    phase?: number | string | null;
    category: string;
    closingRank: number;
    source?: string;
    sourceUrl?: string;
    sourceCollegeCode?: string;
    sourceBranchCode?: string;
  }>;
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

export interface PredictCollegesResponse {
  results: RankedCollegeResult[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
  insights: string[];
}

export interface PredictorFilters {
  course?: string;
  search?: string;
  collegeType?: string;
  city?: string;
  district?: string;
  minFee?: number;
  maxFee?: number;
  hostelRequired?: boolean;
  minPlacementAverage?: number;
  maxNirfRank?: number;
}

export interface PredictCollegesRequest {
  examCode: ExamCode;
  rank: number;
  category?: string;
  cutoffYear?: number;
  cutoffRound?: number;
  discipline?: string;
  courseSelections?: string[];
  horizontalReservations?: string[];
  filters?: PredictorFilters;
  sortBy?: 'nirf' | 'fee_asc' | 'placement_desc';
  page?: number;
  limit?: number;
}
