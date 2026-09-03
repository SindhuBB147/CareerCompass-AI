import { CutoffDocument } from '../models/cutoff.model';

export interface ExamCutoffQuery {
  collegeId?: string; // Keep for backward compatibility
  courseId?: string;  // Keep for backward compatibility
  collegeCode?: string | null;
  courseCode?: string | null;
  examCode: string;
  category: string;
  quota?: string | null;
  year?: number | null;
  round?: number | string | null;
}

export interface CutoffProvenance {
  exam: string;
  year: number | null;
  round: number | string | null;
  category: string;
  quota: string | null;
  source: string;
}

export interface ExamReadinessReport {
  examCode: string;
  realRows: number;
  years: number[];
  rounds: (string | number)[];
  categories: string[];
  quotas: string[];
  openingRankCoverage: number; // percentage (0-100)
  closingRankCoverage: number; // percentage (0-100)
}

export interface IExamCutoffAdapter {
  readonly examCode: string;
  isReadyForEligibility(): boolean;
  isReadyForML(): boolean;
  fetchHistoricalCutoffs(query: ExamCutoffQuery, cutoffModel: any): Promise<CutoffDocument[]>;
  getReadinessReport(cutoffModel: any): Promise<ExamReadinessReport>;
}
