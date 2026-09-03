import { Injectable } from '@nestjs/common';
import { IExamCutoffAdapter, ExamCutoffQuery, ExamReadinessReport } from './exam-cutoff-adapter.interface';
import { CutoffDocument } from '../models/cutoff.model';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ComedkCutoffAdapter implements IExamCutoffAdapter {
  readonly examCode = 'COMEDK';

  isReadyForEligibility(): boolean {
    return true; // 730 clean historical rows available
  }

  isReadyForML(): boolean {
    return false; // Insufficient comparable years (only 2024 All Rounds & 2025 R4)
  }

  async fetchHistoricalCutoffs(query: ExamCutoffQuery, cutoffModel: any): Promise<CutoffDocument[]> {
    const cleanCategory = query.category ? query.category.toUpperCase() : 'GM';
    const filter: any = {
      examCode: 'COMEDK',
      category: cleanCategory,
    };

    const collegeFilter = query.collegeCode || query.collegeId;
    if (collegeFilter) {
      filter.$or = [
        { collegeId: collegeFilter },
        { collegeCode: collegeFilter },
      ];
    }

    const courseFilter = query.courseCode || query.courseId;
    if (courseFilter) {
      filter.$and = [
        {
          $or: [
            { courseId: courseFilter },
            { courseCode: courseFilter },
            { courseCode: new RegExp(courseFilter.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i') },
          ],
        },
      ];
    }

    if (query.year !== undefined && query.year !== null) {
      filter.year = query.year;
    }

    if (query.round !== undefined && query.round !== null) {
      filter.round = query.round;
    }

    if (query.quota !== undefined && query.quota !== null) {
      filter.quota = query.quota;
    }

    return cutoffModel.find(filter).sort({ year: 1, round: 1 }).exec();
  }

  async getReadinessReport(cutoffModel: any): Promise<ExamReadinessReport> {
    const rows = await cutoffModel.find({ examCode: 'COMEDK' }).exec();
    if (rows.length === 0) {
      return {
        examCode: 'COMEDK',
        realRows: 0,
        years: [],
        rounds: [],
        categories: [],
        quotas: [],
        openingRankCoverage: 0,
        closingRankCoverage: 0,
      };
    }

    const years = Array.from(new Set(rows.map((r: any) => r.year))).sort() as number[];
    const rounds = Array.from(new Set(rows.map((r: any) => r.round))).sort() as (string | number)[];
    const categories = Array.from(new Set(rows.map((r: any) => r.category))).sort() as string[];
    const quotas = Array.from(new Set(rows.map((r: any) => r.quota).filter(Boolean))).sort() as string[];

    const withOpening = rows.filter((r: any) => r.openingRank !== null && r.openingRank !== undefined).length;
    const withClosing = rows.filter((r: any) => r.closingRank !== null && r.closingRank !== undefined).length;

    return {
      examCode: 'COMEDK',
      realRows: rows.length,
      years,
      rounds,
      categories,
      quotas,
      openingRankCoverage: parseFloat(((withOpening / rows.length) * 100).toFixed(2)),
      closingRankCoverage: parseFloat(((withClosing / rows.length) * 100).toFixed(2)),
    };
  }
}

@Injectable()
export class KcetCutoffAdapter implements IExamCutoffAdapter {
  readonly examCode = 'KCET';

  private hasRawData(): boolean {
    const candidates = [
      path.resolve(process.cwd(), '../../../files/kcet/raw'),
      path.resolve(process.cwd(), '../../files/kcet/raw'),
      path.resolve(process.cwd(), '../files/kcet/raw'),
      path.resolve(process.cwd(), 'files/kcet/raw'),
      'C:/Users/sindh/Downloads/career-compass-ai/files/kcet/raw',
    ];

    for (const dir of candidates) {
      try {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir).filter(f => !f.startsWith('.') && f !== 'placeholder.txt');
          if (files.length > 0) {
            return true;
          }
        }
      } catch {
        // Ignore read errors
      }
    }
    return false;
  }

  isReadyForEligibility(): boolean {
    return this.hasRawData();
  }

  isReadyForML(): boolean {
    return false;
  }

  async fetchHistoricalCutoffs(query: ExamCutoffQuery, cutoffModel: any): Promise<CutoffDocument[]> {
    if (!this.hasRawData()) {
      return [];
    }

    const cleanCategory = query.category ? query.category.toUpperCase() : 'GM';
    const filter: any = {
      examCode: 'KCET',
      category: cleanCategory,
    };

    const collegeFilter = query.collegeCode || query.collegeId;
    if (collegeFilter) {
      filter.$or = [
        { collegeId: collegeFilter },
        { collegeCode: collegeFilter },
      ];
    }

    const courseFilter = query.courseCode || query.courseId;
    if (courseFilter) {
      filter.$and = [
        {
          $or: [
            { courseId: courseFilter },
            { courseCode: courseFilter },
            { courseCode: new RegExp(courseFilter.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i') },
          ],
        },
      ];
    }

    if (query.year !== undefined && query.year !== null) {
      filter.year = query.year;
    }

    if (query.round !== undefined && query.round !== null) {
      filter.round = query.round;
    }

    if (query.quota !== undefined && query.quota !== null) {
      filter.quota = query.quota;
    }

    return cutoffModel.find(filter).sort({ year: 1, round: 1 }).exec();
  }

  async getReadinessReport(cutoffModel: any): Promise<ExamReadinessReport> {
    if (!this.hasRawData()) {
      return {
        examCode: 'KCET',
        realRows: 0,
        years: [],
        rounds: [],
        categories: [],
        quotas: [],
        openingRankCoverage: 0,
        closingRankCoverage: 0,
      };
    }

    const rows = await cutoffModel.find({ examCode: 'KCET' }).exec();
    if (rows.length === 0) {
      return {
        examCode: 'KCET',
        realRows: 0,
        years: [],
        rounds: [],
        categories: [],
        quotas: [],
        openingRankCoverage: 0,
        closingRankCoverage: 0,
      };
    }

    const years = Array.from(new Set(rows.map((r: any) => r.year))).sort() as number[];
    const rounds = Array.from(new Set(rows.map((r: any) => r.round))).sort() as (string | number)[];
    const categories = Array.from(new Set(rows.map((r: any) => r.category))).sort() as string[];
    const quotas = Array.from(new Set(rows.map((r: any) => r.quota).filter(Boolean))).sort() as string[];

    const withOpening = rows.filter((r: any) => r.openingRank !== null && r.openingRank !== undefined).length;
    const withClosing = rows.filter((r: any) => r.closingRank !== null && r.closingRank !== undefined).length;

    return {
      examCode: 'KCET',
      realRows: rows.length,
      years,
      rounds,
      categories,
      quotas,
      openingRankCoverage: parseFloat(((withOpening / rows.length) * 100).toFixed(2)),
      closingRankCoverage: parseFloat(((withClosing / rows.length) * 100).toFixed(2)),
    };
  }
}

@Injectable()
export class JosaaCutoffAdapter implements IExamCutoffAdapter {
  readonly examCode = 'JEE';

  isReadyForEligibility(): boolean {
    return false;
  }

  isReadyForML(): boolean {
    return false;
  }

  async fetchHistoricalCutoffs(query: ExamCutoffQuery, cutoffModel: any): Promise<CutoffDocument[]> {
    const cleanCategory = query.category ? query.category.toUpperCase() : 'OPEN';
    const filter: any = {
      examCode: 'JEE',
      category: cleanCategory,
    };

    const collegeFilter = query.collegeCode || query.collegeId;
    if (collegeFilter) {
      filter.$or = [
        { collegeId: collegeFilter },
        { collegeCode: collegeFilter },
      ];
    }

    const courseFilter = query.courseCode || query.courseId;
    if (courseFilter) {
      filter.$and = [
        {
          $or: [
            { courseId: courseFilter },
            { courseCode: courseFilter },
            { courseCode: new RegExp(courseFilter.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i') },
          ],
        },
      ];
    }

    if (query.year !== undefined && query.year !== null) {
      filter.year = query.year;
    }

    if (query.round !== undefined && query.round !== null) {
      filter.round = query.round;
    }

    if (query.quota !== undefined && query.quota !== null) {
      filter.quota = query.quota;
    }

    return cutoffModel.find(filter).sort({ year: 1, round: 1 }).exec();
  }

  async getReadinessReport(cutoffModel: any): Promise<ExamReadinessReport> {
    const rows = await cutoffModel.find({ examCode: 'JEE' }).exec();
    if (rows.length === 0) {
      return {
        examCode: 'JEE',
        realRows: 0,
        years: [],
        rounds: [],
        categories: [],
        quotas: [],
        openingRankCoverage: 0,
        closingRankCoverage: 0,
      };
    }

    const years = Array.from(new Set(rows.map((r: any) => r.year))).sort() as number[];
    const rounds = Array.from(new Set(rows.map((r: any) => r.round))).sort() as (string | number)[];
    const categories = Array.from(new Set(rows.map((r: any) => r.category))).sort() as string[];
    const quotas = Array.from(new Set(rows.map((r: any) => r.quota).filter(Boolean))).sort() as string[];

    const withOpening = rows.filter((r: any) => r.openingRank !== null && r.openingRank !== undefined).length;
    const withClosing = rows.filter((r: any) => r.closingRank !== null && r.closingRank !== undefined).length;

    return {
      examCode: 'JEE',
      realRows: rows.length,
      years,
      rounds,
      categories,
      quotas,
      openingRankCoverage: parseFloat(((withOpening / rows.length) * 100).toFixed(2)),
      closingRankCoverage: parseFloat(((withClosing / rows.length) * 100).toFixed(2)),
    };
  }
}

@Injectable()
export class NeetCutoffAdapter implements IExamCutoffAdapter {
  readonly examCode = 'NEET';

  isReadyForEligibility(): boolean {
    return false;
  }

  isReadyForML(): boolean {
    return false;
  }

  async fetchHistoricalCutoffs(query: ExamCutoffQuery, cutoffModel: any): Promise<CutoffDocument[]> {
    const cleanCategory = query.category ? query.category.toUpperCase() : 'UR';
    const filter: any = {
      examCode: 'NEET',
      category: cleanCategory,
    };

    const collegeFilter = query.collegeCode || query.collegeId;
    if (collegeFilter) {
      filter.$or = [
        { collegeId: collegeFilter },
        { collegeCode: collegeFilter },
      ];
    }

    const courseFilter = query.courseCode || query.courseId;
    if (courseFilter) {
      filter.$and = [
        {
          $or: [
            { courseId: courseFilter },
            { courseCode: courseFilter },
            { courseCode: new RegExp(courseFilter.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i') },
          ],
        },
      ];
    }

    if (query.year !== undefined && query.year !== null) {
      filter.year = query.year;
    }

    if (query.round !== undefined && query.round !== null) {
      filter.round = query.round;
    }

    if (query.quota !== undefined && query.quota !== null) {
      filter.quota = query.quota;
    }

    return cutoffModel.find(filter).sort({ year: 1, round: 1 }).exec();
  }

  async getReadinessReport(cutoffModel: any): Promise<ExamReadinessReport> {
    const rows = await cutoffModel.find({ examCode: 'NEET' }).exec();
    if (rows.length === 0) {
      return {
        examCode: 'NEET',
        realRows: 0,
        years: [],
        rounds: [],
        categories: [],
        quotas: [],
        openingRankCoverage: 0,
        closingRankCoverage: 0,
      };
    }

    const years = Array.from(new Set(rows.map((r: any) => r.year))).sort() as number[];
    const rounds = Array.from(new Set(rows.map((r: any) => r.round))).sort() as (string | number)[];
    const categories = Array.from(new Set(rows.map((r: any) => r.category))).sort() as string[];
    const quotas = Array.from(new Set(rows.map((r: any) => r.quota).filter(Boolean))).sort() as string[];

    const withOpening = rows.filter((r: any) => r.openingRank !== null && r.openingRank !== undefined).length;
    const withClosing = rows.filter((r: any) => r.closingRank !== null && r.closingRank !== undefined).length;

    return {
      examCode: 'NEET',
      realRows: rows.length,
      years,
      rounds,
      categories,
      quotas,
      openingRankCoverage: parseFloat(((withOpening / rows.length) * 100).toFixed(2)),
      closingRankCoverage: parseFloat(((withClosing / rows.length) * 100).toFixed(2)),
    };
  }
}
