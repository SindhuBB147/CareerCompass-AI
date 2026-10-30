import { Injectable, OnModuleInit, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Exam, ExamDocument } from './models/exam.model';
import { Cutoff, CutoffConflict, CutoffDocument, CutoffConflictDocument, CutoffImportLog, CutoffImportLogDocument } from './models/cutoff.model';
import { CollegeRepository } from '../colleges/repositories/college.repository';
import { DomainException } from '../../common/filters/domain.exception';
import { NOTIFICATION_EVENTS } from '../notifications/events/notification.events';
import { CutoffQueryDto, BulkRowDto, UpdateCutoffDto, CutoffStatus } from './cutoff.dto';

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type RejectReasonCode =
  | 'missing_fields' | 'unmatched_exam' | 'unmatched_college' | 'unmatched_course' | 'archived_conflict' | 'other';

export class CutoffRowError extends Error {
  constructor(message: string, public reasonCode: RejectReasonCode) {
    super(message);
  }
}

export interface BulkReport {
  importId: string;
  totalRows: number;
  accepted: number;
  rejected: number;
  conflictsCreated: number;
  rejectedRows: Array<{ row: number; reason: string; reasonCode: RejectReasonCode }>;
}

export type RowPreviewStatus = 'valid' | 'needs_review' | 'invalid' | 'unmatched_college' | 'unmatched_course';

export interface RowPreview {
  row: number;
  status: RowPreviewStatus;
  collegeId?: string;
  collegeName?: string;
  courseId?: string;
  courseName?: string;
  examCode?: string;
  year?: number;
  round?: number;
  category?: string;
  closingRank?: number;
  action?: 'create' | 'update' | 'conflict';
  reason?: string;
  reasonCode?: RejectReasonCode;
}

// Canonical category options per exam — drives the "Add Cutoff" category dropdown so admins
// pick from the dataset's real category codes instead of free-typing them.
export const EXAM_CATEGORIES: Record<string, string[]> = {
  KCET: [
    'GM', 'GMK', 'GMR',
    '1G', '1K', '1R',
    '2AG', '2AK', '2AR',
    '2BG', '2BK', '2BR',
    '3AG', '3AK', '3AR',
    '3BG', '3BK', '3BR',
    'SCG', 'SCK', 'SCR',
    'STG', 'STK', 'STR',
    'EWS', 'HK', 'SNQ',
  ],
  COMEDK: ['GM'],
  NEET: ['GM', 'EWS', 'SC', 'ST', 'OBC', 'PwD'],
  JEE: ['GEN', 'EWS', 'OBC-NCL', 'SC', 'ST', 'PwD'],
};

@Injectable()
export class CutoffService implements OnModuleInit {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<ExamDocument>,
    @InjectModel(Cutoff.name) private readonly cutoffModel: Model<CutoffDocument>,
    @InjectModel(CutoffConflict.name) private readonly conflictModel: Model<CutoffConflictDocument>,
    @InjectModel(CutoffImportLog.name) private readonly importLogModel: Model<CutoffImportLogDocument>,
    private readonly collegeRepo: CollegeRepository,
    private readonly events: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seedExamsIfEmpty();
      await this.seedCutoffsIfEmpty();
    } catch {
      // Ignore seed error if DB is unreachable during build/init
    }
  }

  // ── Exams ────────────────────────────────────────────────────────────────────
  async examExists(code: string): Promise<boolean> {
    return !!(await this.examModel.exists({ code: code.toUpperCase(), isActive: true }));
  }

  getActiveExams() {
    return this.examModel.find({ isActive: true }).exec();
  }

  async getExamRounds(examCode: string): Promise<ExamDocument | null> {
    return this.examModel.findOne({ code: examCode.toUpperCase(), isActive: true }).sort({ year: -1 }).exec();
  }

  getExamCategories(examCode: string): string[] {
    return EXAM_CATEGORIES[examCode.toUpperCase()] ?? EXAM_CATEGORIES.KCET;
  }

  // ── Cutoff Trend (Legacy method for Predictor & Counsellor integration) ──────
  async getTrend(collegeId: string, courseId: string, examCode: string, category: string): Promise<CutoffDocument[]> {
    if (!(await this.collegeRepo.exists(collegeId))) {
      throw new DomainException('NOT_FOUND', `College "${collegeId}" not found.`, HttpStatus.NOT_FOUND);
    }
    return this.cutoffModel.find({ collegeId, courseId, examCode: examCode.toUpperCase(), category, status: 'verified' }).sort({ year: 1, round: 1 }).exec();
  }

  async countVerifiedCutoffs(examCode: string): Promise<number> {
    return this.cutoffModel.countDocuments({ examCode: examCode.toUpperCase(), status: 'verified' }).exec();
  }

  async findVerifiedCutoffs(examCode: string, filters: { category?: string; year?: number; round?: number } = {}): Promise<CutoffDocument[]> {
    const query: Record<string, any> = { examCode: examCode.toUpperCase(), status: 'verified' };
    if (filters.category) query.category = filters.category.trim().toUpperCase();
    if (filters.year) query.year = filters.year;
    if (filters.round) query.round = filters.round;
    return this.cutoffModel.find(query).sort({ year: -1, round: -1, collegeId: 1, courseId: 1 }).exec();
  }

  // ── Cutoff Queries & Facets ──────────────────────────────────────────────────
  async getFilteredCutoffs(collegeId: string, query: CutoffQueryDto) {
    if (!(await this.collegeRepo.exists(collegeId))) {
      throw new DomainException('NOT_FOUND', `College "${collegeId}" not found.`, HttpStatus.NOT_FOUND);
    }

    const filter: Record<string, any> = { collegeId };

    // Archived records are hidden by default everywhere (admin table, public college
    // profile, prediction feed) unless an admin explicitly asks to see them.
    filter.status = query.status ? query.status : { $ne: 'archived' };

    if (query.examCode) filter.examCode = query.examCode.toUpperCase();
    if (query.year) filter.year = Number(query.year);
    if (query.round) filter.round = Number(query.round);
    if (query.courseId) filter.courseId = query.courseId;
    if (query.category) filter.category = query.category;
    if (query.branch) filter.branch = query.branch;

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { courseId: searchRegex },
        { courseName: searchRegex },
        { category: searchRegex },
      ];
    }

    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sortField = query.sortBy || 'year';
    const sortObj: Record<string, any> = {};
    sortObj[sortField] = sortOrder;
    if (sortField !== 'round') sortObj.round = 1;

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [results, total] = await Promise.all([
      this.cutoffModel.find(filter).sort(sortObj).skip(skip).limit(limit).exec(),
      this.cutoffModel.countDocuments(filter).exec(),
    ]);

    return {
      results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getFacets(collegeId: string, examCode?: string) {
    if (!(await this.collegeRepo.exists(collegeId))) {
      throw new DomainException('NOT_FOUND', `College "${collegeId}" not found.`, HttpStatus.NOT_FOUND);
    }

    const match: Record<string, any> = { collegeId, status: { $ne: 'archived' } };
    if (examCode) match.examCode = examCode.toUpperCase();

    const [years, rounds, categories, courses, branches] = await Promise.all([
      this.cutoffModel.distinct('year', match).exec(),
      this.cutoffModel.distinct('round', match).exec(),
      this.cutoffModel.distinct('category', match).exec(),
      this.cutoffModel.distinct('courseId', match).exec(),
      this.cutoffModel.distinct('branch', match).exec(),
    ]);

    return {
      years: (years as number[]).sort((a, b) => b - a),
      rounds: (rounds as number[]).sort((a, b) => a - b),
      categories: (categories as string[]).sort(),
      courses: (courses as string[]).sort(),
      branches: (branches as string[]).filter(Boolean).sort(),
    };
  }

  async getSummary(collegeId: string, examCode?: string, courseId?: string, category?: string) {
    if (!(await this.collegeRepo.exists(collegeId))) {
      throw new DomainException('NOT_FOUND', `College "${collegeId}" not found.`, HttpStatus.NOT_FOUND);
    }

    const match: Record<string, any> = { collegeId, status: { $ne: 'archived' } };
    if (examCode) match.examCode = examCode.toUpperCase();
    if (courseId) match.courseId = courseId;
    if (category) match.category = category;

    const cutoffs = await this.cutoffModel.find(match).exec();
    if (cutoffs.length === 0) {
      return {
        latestAcademicYear: null,
        latestRound: null,
        lowestClosingRank: null,
        highestClosingRank: null,
        totalCourses: 0,
        totalRecords: 0,
        lastUpdated: null,
      };
    }

    const years = cutoffs.map((c) => c.year);
    const rounds = cutoffs.map((c) => c.round);
    const closingRanks = cutoffs.map((c) => c.closingRank).filter((r) => typeof r === 'number' && r > 0);
    const distinctCourses = new Set(cutoffs.map((c) => c.courseId)).size;
    const latestUpdated = cutoffs.reduce((latest, c) => (!latest || (c.lastUpdated && c.lastUpdated > latest) ? c.lastUpdated : latest), null as Date | null);

    return {
      latestAcademicYear: Math.max(...years),
      latestRound: Math.max(...rounds),
      lowestClosingRank: closingRanks.length ? Math.min(...closingRanks) : null,
      highestClosingRank: closingRanks.length ? Math.max(...closingRanks) : null,
      totalCourses: distinctCourses,
      totalRecords: cutoffs.length,
      lastUpdated: latestUpdated || new Date(),
    };
  }

  async getTrends(collegeId: string, courseId?: string, examCode?: string, category: string = 'GM') {
    if (!(await this.collegeRepo.exists(collegeId))) {
      throw new DomainException('NOT_FOUND', `College "${collegeId}" not found.`, HttpStatus.NOT_FOUND);
    }

    const match: Record<string, any> = { collegeId, status: { $ne: 'archived' } };
    if (examCode) match.examCode = examCode.toUpperCase();
    if (courseId) match.courseId = courseId;
    if (category) match.category = category;

    const rows = await this.cutoffModel.find(match).sort({ year: 1, round: 1 }).exec();

    // Group by year to format multi-year trends
    const yearMap = new Map<number, { year: number; round1Closing?: number; round2Closing?: number; mopUpClosing?: number; latestClosing: number }>();
    for (const r of rows) {
      let entry = yearMap.get(r.year);
      if (!entry) {
        entry = { year: r.year, latestClosing: r.closingRank };
        yearMap.set(r.year, entry);
      }
      if (r.round === 1) entry.round1Closing = r.closingRank;
      if (r.round === 2) entry.round2Closing = r.closingRank;
      if (r.round >= 3) entry.mopUpClosing = r.closingRank;
      entry.latestClosing = r.closingRank;
    }

    return {
      rows,
      yearSummary: Array.from(yearMap.values()),
    };
  }

  async getAIInsights(collegeId: string, courseId?: string, examCode?: string, category: string = 'GM') {
    const { yearSummary, rows } = await this.getTrends(collegeId, courseId, examCode, category);

    if (yearSummary.length < 2) {
      return {
        isAIEstimate: true,
        trendDirection: 'stable',
        percentageChange: 0,
        summaryText: `Insufficient multi-year cutoff historical data to compute AI trend analysis for ${examCode || 'selected exam'}.`,
        predictedRankRange: null,
        admissionProbability: 'moderate',
        keyInsights: [
          'More historical years are needed to project year-over-year rank shifts.',
          'Cutoffs typically vary based on exam difficulty, total candidate volume, and seat matrix changes.',
        ],
      };
    }

    const sortedYears = [...yearSummary].sort((a, b) => a.year - b.year);
    const earliest = sortedYears[0];
    const latest = sortedYears[sortedYears.length - 1];

    const rankDiff = latest.latestClosing - earliest.latestClosing;
    const percentageChange = Math.round(((earliest.latestClosing - latest.latestClosing) / earliest.latestClosing) * 100);

    let trendDirection: 'tightened' | 'relaxed' | 'stable' = 'stable';
    if (percentageChange > 3) trendDirection = 'tightened'; // Lower closing rank number = more competitive
    else if (percentageChange < -3) trendDirection = 'relaxed';

    // AI Prediction heuristic for next year
    const avgYearlyShift = (latest.latestClosing - earliest.latestClosing) / (sortedYears.length - 1);
    const predictedClosing = Math.max(1, Math.round(latest.latestClosing + avgYearlyShift));
    const predictedMin = Math.max(1, Math.round(predictedClosing * 0.92));
    const predictedMax = Math.round(predictedClosing * 1.08);

    const keyInsights: string[] = [];
    if (trendDirection === 'tightened') {
      keyInsights.push(`Cutoffs have become ${Math.abs(percentageChange)}% more competitive over the past ${sortedYears.length} years.`);
      keyInsights.push(`Closing rank for ${category} category improved from #${earliest.latestClosing} (${earliest.year}) to #${latest.latestClosing} (${latest.year}).`);
    } else if (trendDirection === 'relaxed') {
      keyInsights.push(`Cutoffs have relaxed by ${Math.abs(percentageChange)}% over the past ${sortedYears.length} years.`);
      keyInsights.push(`Closing rank moved from #${earliest.latestClosing} (${earliest.year}) to #${latest.latestClosing} (${latest.year}).`);
    } else {
      keyInsights.push(`Cutoffs have remained relatively stable around #${latest.latestClosing} across recent years.`);
    }

    if (latest.round1Closing && latest.round2Closing) {
      const roundShift = latest.round2Closing - latest.round1Closing;
      if (roundShift > 0) {
        keyInsights.push(`Round 2 closing rank relaxed by ${roundShift} ranks compared to Round 1 in ${latest.year}.`);
      }
    }

    keyInsights.push(`AI Expected Cutoff Range for next academic year: #${predictedMin} - #${predictedMax}.`);

    return {
      isAIEstimate: true,
      trendDirection,
      percentageChange,
      summaryText: `Based on historical trend analysis from ${earliest.year} to ${latest.year}, cutoffs for ${category} category have ${trendDirection === 'tightened' ? 'become more competitive' : trendDirection === 'relaxed' ? 'relaxed slightly' : 'remained steady'}.`,
      predictedRankRange: { min: predictedMin, max: predictedMax, expected: predictedClosing },
      admissionProbability: percentageChange >= 0 ? 'high' : 'moderate',
      keyInsights,
    };
  }

  // ── Bulk Import & Admin Operations ───────────────────────────────────────────

  // Resolves and validates one row against real data. Shared by the dry-run preview
  // (validateRows) and the real commit (bulkUpload) so the two can never drift.
  // Matches college by ID/code/slug (CollegeRepository already handles that) and
  // course by exact code OR exact name, then returns the college's *actual* internal
  // ID — never the raw value the admin typed — so every cutoff for a college is keyed
  // identically regardless of whether the import used its code, name, or ObjectId.
  private async resolveRow(row: BulkRowDto): Promise<{ examCode: string; collegeId: string; collegeName: string; courseId: string; courseName?: string }> {
    if (!row.collegeId || !row.courseId || !row.examCode || !row.year || !row.round || !row.category || !row.closingRank) {
      throw new CutoffRowError('Missing required cutoff fields', 'missing_fields');
    }

    const examCode = row.examCode.toUpperCase();
    if (!(await this.examExists(examCode))) {
      throw new CutoffRowError(`Exam "${examCode}" is not registered`, 'unmatched_exam');
    }

    const collegeInput = row.collegeId.trim();
    // findById already handles ObjectId / stable code (E005) / alternate code / slug — the one
    // thing it doesn't try is the college's exact display name, which is what most admins
    // will actually type into a spreadsheet, so fall back to a case-insensitive exact match on it.
    const college = (await this.collegeRepo.findById(collegeInput))
      ?? (await this.collegeRepo.getModel().findOne({ name: new RegExp(`^${escapeRegExp(collegeInput)}$`, 'i') }).exec());
    if (!college) {
      throw new CutoffRowError(`College "${row.collegeId}" not found — use the college's code (e.g. E005), exact name, or internal ID`, 'unmatched_college');
    }

    const normalizedInput = row.courseId.trim().toLowerCase();
    const matchedCourse = college.courses?.find((c) => c.courseId === row.courseId)
      ?? college.courses?.find((c) => c.courseId?.trim().toLowerCase() === normalizedInput)
      ?? college.courses?.find((c) => c.name?.trim().toLowerCase() === normalizedInput);
    if (!matchedCourse) {
      throw new CutoffRowError(`Course "${row.courseId}" is not offered by "${college.name}" — use the course's code or its exact name`, 'unmatched_course');
    }

    return { examCode, collegeId: college.id, collegeName: college.name, courseId: matchedCourse.courseId, courseName: matchedCourse.name };
  }

  async validateRows(rows: BulkRowDto[]): Promise<{ summary: Record<RowPreviewStatus, number> & { total: number }; rows: RowPreview[] }> {
    const previews: RowPreview[] = [];
    const summary = { total: rows.length, valid: 0, needs_review: 0, invalid: 0, unmatched_college: 0, unmatched_course: 0 };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const base = {
        row: i + 1, examCode: row.examCode?.toUpperCase(), year: Number(row.year), round: Number(row.round),
        category: row.category, closingRank: row.closingRank,
      };
      try {
        const { examCode, collegeId, collegeName, courseId, courseName } = await this.resolveRow(row);
        const key = { collegeId, courseId, examCode, year: Number(row.year), round: Number(row.round), category: row.category };
        const existing = await this.cutoffModel.findOne(key).exec();

        if (existing?.status === 'archived') {
          previews.push({ ...base, status: 'invalid', collegeId, collegeName, courseId, courseName, reason: 'A matching record was archived — restore it before re-importing', reasonCode: 'archived_conflict' });
          summary.invalid++;
        } else if (!existing) {
          previews.push({ ...base, status: 'valid', collegeId, collegeName, courseId, courseName, action: 'create' });
          summary.valid++;
        } else if (existing.closingRank === row.closingRank) {
          previews.push({ ...base, status: 'valid', collegeId, collegeName, courseId, courseName, action: 'update' });
          summary.valid++;
        } else {
          previews.push({ ...base, status: 'needs_review', collegeId, collegeName, courseId, courseName, action: 'conflict', reason: `Existing closing rank #${existing.closingRank} differs from incoming #${row.closingRank}` });
          summary.needs_review++;
        }
      } catch (err) {
        const reasonCode = err instanceof CutoffRowError ? err.reasonCode : 'other';
        const status: RowPreviewStatus = reasonCode === 'unmatched_college' ? 'unmatched_college' : reasonCode === 'unmatched_course' ? 'unmatched_course' : 'invalid';
        previews.push({ ...base, status, reason: err instanceof Error ? err.message : 'Invalid row format', reasonCode });
        summary[status]++;
      }
    }

    return { summary, rows: previews };
  }

  async bulkUpload(
    rows: BulkRowDto[],
    fileName: string = 'cutoffs_import.csv',
    overwriteExisting: boolean = true,
    adminId: string = 'system_admin',
    source: 'import' | 'manual_admin_entry' = 'import',
  ): Promise<BulkReport> {
    const importId = `IMP_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const report: BulkReport = {
      importId,
      totalRows: rows.length,
      accepted: 0,
      rejected: 0,
      conflictsCreated: 0,
      rejectedRows: [],
    };

    const affectedCutoffIds: string[] = [];
    const touchedCollegeIds = new Set<string>();
    let insertedCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const { examCode, collegeId, courseId, courseName } = await this.resolveRow(row);

        const key = {
          collegeId,
          courseId,
          examCode,
          year: Number(row.year),
          round: Number(row.round),
          category: row.category,
        };

        const existing = await this.cutoffModel.findOne(key).exec();

        if (existing?.status === 'archived') {
          throw new CutoffRowError('A matching record was archived by an admin — restore it before importing an update, to avoid silently overwriting that decision', 'archived_conflict');
        }

        if (!existing) {
          const created = await this.cutoffModel.create({
            ...key,
            courseName: row.courseName || courseName,
            branch: row.branch,
            closingRank: Number(row.closingRank),
            source,
            verifiedBy: adminId,
            status: source === 'import' ? 'imported' : 'verified',
            lastUpdated: new Date(),
          });
          affectedCutoffIds.push(created._id.toString());
          insertedCount++;
          report.accepted++;
        } else if (overwriteExisting || existing.closingRank === row.closingRank) {
          await this.cutoffModel.findByIdAndUpdate(existing._id, {
            courseName: row.courseName || courseName || existing.courseName,
            branch: row.branch || existing.branch,
            closingRank: Number(row.closingRank),
            source,
            verifiedBy: adminId,
            lastUpdated: new Date(),
          });
          affectedCutoffIds.push(existing._id.toString());
          updatedCount++;
          report.accepted++;
        } else {
          await this.conflictModel.create({
            ...key,
            field: 'closingRank',
            existingValue: existing.closingRank,
            incomingValue: row.closingRank,
            status: 'open',
          });
          report.conflictsCreated++;
        }

        touchedCollegeIds.add(collegeId);
      } catch (err) {
        report.rejected++;
        report.rejectedRows.push({
          row: i + 1,
          reason: err instanceof Error ? err.message : 'Invalid row format',
          reasonCode: err instanceof CutoffRowError ? err.reasonCode : 'other',
        });
      }
    }

    // Record import audit log
    await this.importLogModel.create({
      importId,
      fileName,
      totalRows: rows.length,
      insertedCount,
      updatedCount,
      failedCount: report.rejected,
      errorLog: report.rejectedRows.map((r) => `Row ${r.row}: ${r.reason}`),
      status: report.rejected === rows.length ? 'failed' : 'completed',
      uploadedBy: adminId,
      affectedCutoffIds,
    });

    for (const cid of touchedCollegeIds) {
      const college = await this.collegeRepo.findById(cid);
      if (college) {
        this.events.emit(NOTIFICATION_EVENTS.COLLEGE_UPDATED, {
          collegeId: cid,
          collegeName: college.name,
          subtype: 'cutoff_updated',
          summary: `${college.name} cutoff ranks updated via import.`,
        });
      }
    }

    return report;
  }

  async listImports() {
    return this.importLogModel.find().sort({ createdAt: -1 }).limit(50).exec();
  }

  async rollbackImport(importId: string, adminId: string = 'system_admin') {
    const log = await this.importLogModel.findOne({ importId }).exec();
    if (!log) throw new DomainException('NOT_FOUND', `Import record "${importId}" not found.`, HttpStatus.NOT_FOUND);
    if (log.status === 'rolled_back') throw new DomainException('CONFLICT', 'Import is already rolled back.', HttpStatus.CONFLICT);

    if (log.affectedCutoffIds.length > 0) {
      await this.cutoffModel.deleteMany({ _id: { $in: log.affectedCutoffIds } }).exec();
    }

    await this.importLogModel.findOneAndUpdate({ importId }, { status: 'rolled_back' }).exec();
    return { success: true, importId, rolledBackCount: log.affectedCutoffIds.length };
  }

  async createCutoff(dto: BulkRowDto, adminId: string = 'system_admin') {
    const report = await this.bulkUpload([dto], 'manual_entry.csv', true, adminId, 'manual_admin_entry');
    if (report.rejected > 0) {
      throw new DomainException('BAD_REQUEST', report.rejectedRows[0]?.reason || 'Failed to create cutoff', HttpStatus.BAD_REQUEST);
    }
    // Re-resolve the same way bulkUpload did — dto.collegeId/courseId may be a code or
    // name rather than the internal ID actually stored, so a raw re-query could miss it.
    const { collegeId, courseId, examCode } = await this.resolveRow(dto);
    const created = await this.cutoffModel.findOne({
      collegeId,
      courseId,
      examCode,
      year: dto.year,
      round: dto.round,
      category: dto.category,
    }).exec();
    await this.collegeRepo.recordAudit({ adminId, action: 'cutoff.create', targetCollection: 'cutoffs', targetId: created?.id ?? dto.collegeId, afterSnapshot: dto as any });
    return created;
  }

  async updateCutoff(id: string, dto: UpdateCutoffDto, adminId: string = 'system_admin') {
    const cutoff = await this.cutoffModel.findById(id).exec();
    if (!cutoff) throw new DomainException('NOT_FOUND', `Cutoff record "${id}" not found.`, HttpStatus.NOT_FOUND);

    const updated = await this.cutoffModel.findByIdAndUpdate(
      id,
      {
        ...dto,
        verifiedBy: adminId,
        lastUpdated: new Date(),
      },
      { new: true },
    ).exec();

    await this.collegeRepo.recordAudit({ adminId, action: 'cutoff.update', targetCollection: 'cutoffs', targetId: id, afterSnapshot: dto as any });
    return updated;
  }

  // Soft delete: archiving is the default so admins can undo it and so accidental
  // deletes don't silently strip data other modules (predictor, college profile) rely on.
  async deleteCutoff(id: string, adminId: string = 'system_admin') {
    const before = await this.cutoffModel.findById(id).exec();
    if (!before) throw new DomainException('NOT_FOUND', `Cutoff record "${id}" not found.`, HttpStatus.NOT_FOUND);
    const cutoff = await this.cutoffModel.findByIdAndUpdate(id, { status: 'archived', lastUpdated: new Date() }, { new: true }).exec();
    await this.collegeRepo.recordAudit({ adminId, action: 'cutoff.archive', targetCollection: 'cutoffs', targetId: id, beforeSnapshot: before as any, afterSnapshot: cutoff as any });
    return { success: true, id };
  }

  async bulkDeleteCutoffs(ids: string[], adminId: string = 'system_admin') {
    const result = await this.cutoffModel.updateMany({ _id: { $in: ids } }, { status: 'archived', lastUpdated: new Date() }).exec();
    await this.collegeRepo.recordAudit({ adminId, action: 'cutoff.bulk_archive', targetCollection: 'cutoffs', targetId: `bulk:${ids.length}`, afterSnapshot: { ids } as any });
    return { success: true, deletedCount: result.modifiedCount };
  }

  // Verify / flag-for-review / restore / mark-invalid all funnel through here.
  async setCutoffStatus(id: string, status: CutoffStatus, adminId: string = 'system_admin') {
    const before = await this.cutoffModel.findById(id).exec();
    if (!before) throw new DomainException('NOT_FOUND', `Cutoff record "${id}" not found.`, HttpStatus.NOT_FOUND);
    const updated = await this.cutoffModel.findByIdAndUpdate(
      id,
      { status, verifiedBy: status === 'verified' ? adminId : before.verifiedBy, lastUpdated: new Date() },
      { new: true },
    ).exec();
    await this.collegeRepo.recordAudit({ adminId, action: 'cutoff.status_change', targetCollection: 'cutoffs', targetId: id, beforeSnapshot: { status: before.status } as any, afterSnapshot: { status } as any });
    return updated;
  }

  // ── Conflicts Resolution ──────────────────────────────────────────────────────
  listOpenConflicts() {
    return this.conflictModel.find({ status: 'open' }).sort({ createdAt: -1 }).exec();
  }

  async resolveConflict(conflictId: string, resolvedValue: number, adminId: string): Promise<void> {
    const conflict = await this.conflictModel.findById(conflictId).exec();
    if (!conflict) throw new DomainException('NOT_FOUND', 'Conflict not found.', HttpStatus.NOT_FOUND);
    if (conflict.status === 'resolved') throw new DomainException('CONFLICT', 'Already resolved.', HttpStatus.CONFLICT);

    const key = {
      collegeId: conflict.collegeId,
      courseId: conflict.courseId,
      examCode: conflict.examCode,
      category: conflict.category,
      year: conflict.year,
      round: conflict.round,
    };
    const existingCutoff = await this.cutoffModel.findOne(key).exec();
    if (existingCutoff) {
      await this.cutoffModel.findByIdAndUpdate(existingCutoff.id, { closingRank: resolvedValue, verifiedBy: adminId, status: 'verified', lastUpdated: new Date() });
    } else {
      await this.cutoffModel.create({ ...key, closingRank: resolvedValue, source: 'manual_admin_entry', verifiedBy: adminId, status: 'verified' });
    }

    await this.conflictModel.findByIdAndUpdate(conflictId, { status: 'resolved', resolvedValue, resolvedBy: adminId });
  }

  // ── Admin Dashboard ──────────────────────────────────────────────────────────
  async getDashboardStats() {
    const active = { status: { $ne: 'archived' } };

    const [
      totalRecords,
      collegeIds,
      collegeCourseCombos,
      examCounts,
      latestYearAgg,
      latestImport,
      needsReviewCount,
      needsReviewSample,
    ] = await Promise.all([
      this.cutoffModel.countDocuments(active).exec(),
      this.cutoffModel.distinct('collegeId', active).exec(),
      this.cutoffModel.aggregate([{ $match: active }, { $group: { _id: { collegeId: '$collegeId', courseId: '$courseId' } } }, { $count: 'total' }]).exec(),
      this.cutoffModel.aggregate([{ $match: active }, { $group: { _id: '$examCode', count: { $sum: 1 } } }]).exec(),
      this.cutoffModel.aggregate([{ $match: active }, { $group: { _id: null, maxYear: { $max: '$year' } } }]).exec(),
      this.importLogModel.findOne().sort({ createdAt: -1 }).exec(),
      this.cutoffModel.countDocuments({ ...active, status: 'needs_review' }).exec(),
      this.cutoffModel.find({ ...active, status: 'needs_review' }).sort({ lastUpdated: -1 }).limit(10).exec(),
    ]);

    const examCountMap = new Map(examCounts.map((e: any) => [e._id, e.count]));
    const collegeNames = new Map<string, string>();
    await Promise.all(
      [...new Set(needsReviewSample.map((r) => r.collegeId))].map(async (cid) => {
        const college = await this.collegeRepo.findById(cid);
        if (college) collegeNames.set(cid, college.name);
      }),
    );

    return {
      totalRecords,
      totalCollegesWithCutoffs: collegeIds.length,
      totalCoursesWithCutoffs: collegeCourseCombos[0]?.total ?? 0,
      kcetRecords: examCountMap.get('KCET') ?? 0,
      comedkRecords: examCountMap.get('COMEDK') ?? 0,
      neetRecords: examCountMap.get('NEET') ?? 0,
      otherExamRecords: totalRecords - (examCountMap.get('KCET') ?? 0) - (examCountMap.get('COMEDK') ?? 0) - (examCountMap.get('NEET') ?? 0),
      latestAcademicYear: latestYearAgg[0]?.maxYear ?? null,
      latestImport: latestImport ? { importId: latestImport.importId, fileName: latestImport.fileName, uploadedBy: latestImport.uploadedBy, createdAt: (latestImport as any).createdAt } : null,
      recordsRequiringReview: needsReviewCount,
      reviewSample: needsReviewSample.map((r) => ({
        id: r._id.toString(),
        collegeId: r.collegeId,
        collegeName: collegeNames.get(r.collegeId) ?? r.collegeId,
        courseId: r.courseId,
        courseName: r.courseName,
        examCode: r.examCode,
        year: r.year,
        category: r.category,
        closingRank: r.closingRank,
      })),
    };
  }

  // ── Initial seed data ────────────────────────────────────────────────────────
  private async seedExamsIfEmpty(): Promise<void> {
    const count = await this.examModel.countDocuments().exec();
    if (count > 0) return;

    const year = new Date().getFullYear();
    await this.examModel.insertMany([
      { code: 'KCET', name: 'Karnataka Common Entrance Test', conductingBody: 'Karnataka Examinations Authority', applicableStates: ['Karnataka'], year, isActive: true, rounds: [] },
      { code: 'COMEDK', name: 'Consortium of Medical, Engineering and Dental Colleges of Karnataka', conductingBody: 'COMEDK', applicableStates: ['Karnataka'], year, isActive: true, rounds: [] },
      { code: 'NEET', name: 'National Eligibility cum Entrance Test', conductingBody: 'NTA', applicableStates: ['Karnataka'], year, isActive: true, rounds: [] },
      { code: 'JEE', name: 'Joint Entrance Examination (Main)', conductingBody: 'NTA', applicableStates: ['Karnataka'], year, isActive: true, rounds: [] },
    ]);
  }

  private async seedCutoffsIfEmpty(): Promise<void> {
    // Cutoffs are source data and cannot be inferred from course summaries.
    // Startup must never synthesize historical ranks or claim unverified provenance.
  }
}
