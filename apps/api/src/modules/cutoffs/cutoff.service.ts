import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { Exam, ExamDocument } from './models/exam.model';
import { Cutoff, CutoffConflict, CutoffDocument, CutoffConflictDocument } from './models/cutoff.model';
import { CollegeRepository } from '../colleges/repositories/college.repository';
import { DomainException } from '../../common/filters/domain.exception';
import { HttpStatus } from '@nestjs/common';
import { NOTIFICATION_EVENTS } from '../notifications/events/notification.events';
import {
  IExamCutoffAdapter,
  ExamCutoffQuery,
  ExamReadinessReport,
} from './adapters/exam-cutoff-adapter.interface';
import {
  ComedkCutoffAdapter,
  KcetCutoffAdapter,
  JosaaCutoffAdapter,
  NeetCutoffAdapter,
} from './adapters/comedk-cutoff.adapter';

export interface CutoffKey { collegeId: string; courseId: string; examCode: string; category: string; year: number; round: number | string; }
export interface BulkRow extends CutoffKey { openingRank?: number; closingRank: number; seatsAvailable?: number; }
export interface BulkReport { totalRows: number; accepted: number; rejected: number; conflictsCreated: number; rejectedRows: Array<{ row: number; reason: string }>; }

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

@Injectable()
export class CutoffService implements OnModuleInit {
  private readonly adapters = new Map<string, IExamCutoffAdapter>();

  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<ExamDocument>,
    @InjectModel(Cutoff.name) private readonly cutoffModel: Model<CutoffDocument>,
    @InjectModel(CutoffConflict.name) private readonly conflictModel: Model<CutoffConflictDocument>,
    private readonly collegeRepo: CollegeRepository,
    private readonly events: EventEmitter2,
  ) {
    const comedk = new ComedkCutoffAdapter();
    const kcet = new KcetCutoffAdapter();
    const jee = new JosaaCutoffAdapter();
    const neet = new NeetCutoffAdapter();
    this.adapters.set(comedk.examCode, comedk);
    this.adapters.set(kcet.examCode, kcet);
    this.adapters.set(jee.examCode, jee);
    this.adapters.set(neet.examCode, neet);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.seedExamsIfEmpty();
      await this.seedComedkCutoffsIfEmpty();
    } catch {
      // Ignore seed error if DB is unreachable in offline mode
    }
  }

  getAdapter(examCode: string): IExamCutoffAdapter | undefined {
    return this.adapters.get(examCode.toUpperCase());
  }

  // ── Exams ────────────────────────────────────────────────────────────────────
  async examExists(code: string): Promise<boolean> {
    return !!(await this.examModel.exists({ code: code.toUpperCase(), isActive: true }));
  }

  getActiveExams() { return this.examModel.find({ isActive: true }).exec(); }

  async getExamRounds(examCode: string): Promise<ExamDocument | null> {
    return this.examModel.findOne({ code: examCode.toUpperCase(), isActive: true }).sort({ year: -1 }).exec();
  }

  // ── Cutoff Trend (Delegated to Exam-Specific Adapters) ──────────────────────
  async getTrend(
    collegeId: string,
    courseId: string,
    examCode: string,
    category: string,
    quota?: string | null,
    year?: number | null,
    round?: number | string | null,
  ): Promise<CutoffDocument[]> {
    const cleanExam = examCode ? examCode.toUpperCase() : 'COMEDK';
    const adapter = this.adapters.get(cleanExam) || this.adapters.get('COMEDK')!;
    const query: ExamCutoffQuery = {
      collegeId,
      courseId,
      collegeCode: collegeId,
      courseCode: courseId,
      examCode: cleanExam,
      category,
      quota,
      year: year ?? undefined,
      round: round ?? undefined,
    };
    return adapter.fetchHistoricalCutoffs(query, this.cutoffModel);
  }

  async getReadinessReports(): Promise<ExamReadinessReport[]> {
    const reports: ExamReadinessReport[] = [];
    for (const adapter of this.adapters.values()) {
      reports.push(await adapter.getReadinessReport(this.cutoffModel));
    }
    return reports;
  }

  // ── Bulk Upload ───────────────────────────────────────────────────────────────
  async bulkUpload(rows: BulkRow[]): Promise<BulkReport> {
    const report: BulkReport = { totalRows: rows.length, accepted: 0, rejected: 0, conflictsCreated: 0, rejectedRows: [] };
    const touchedCollegeIds = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      try {
        await this.processRow(rows[i], i, report);
        touchedCollegeIds.add(rows[i].collegeId);
      } catch (err) {
        report.rejected++;
        report.rejectedRows.push({ row: i, reason: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    for (const collegeId of touchedCollegeIds) {
      const college = await this.collegeRepo.findById(collegeId);
      if (!college) continue;
      this.events.emit(NOTIFICATION_EVENTS.COLLEGE_UPDATED, {
        collegeId, collegeName: college.name, subtype: 'cutoff_updated',
        summary: `${college.name} has updated cutoff ranks available.`,
      });
    }
    this.events.emit(NOTIFICATION_EVENTS.ADMIN_SYSTEM_EVENT, {
      subtype: report.rejected > 0 ? 'dataset_update_failed' : 'bulk_import_completed',
      message: `Cutoff bulk upload processed ${report.totalRows} row(s): ${report.accepted} accepted, ${report.rejected} rejected.`,
    });
    return report;
  }

  private async processRow(row: BulkRow, idx: number, report: BulkReport): Promise<void> {
    if (!(await this.examExists(row.examCode)))
      throw new Error(`"${row.examCode}" is not a supported exam.`);
    if (!(await this.collegeRepo.exists(row.collegeId)))
      throw new Error(`College "${row.collegeId}" not found.`);

    const key = { ...row, examCode: row.examCode.toUpperCase() };
    const existing = await this.cutoffModel.findOne(key).exec();

    if (!existing) {
      await this.cutoffModel.create({ ...key, source: 'official' });
      report.accepted++;
      return;
    }
    if (existing.closingRank === row.closingRank) { report.accepted++; return; }

    await this.conflictModel.create({ ...key, field: 'closingRank', existingValue: existing.closingRank, incomingValue: row.closingRank, status: 'open' });
    report.conflictsCreated++;
  }

  // ── Conflicts ─────────────────────────────────────────────────────────────────
  listOpenConflicts() { return this.conflictModel.find({ status: 'open' }).sort({ createdAt: -1 }).exec(); }

  async resolveConflict(conflictId: string, resolvedValue: number, adminId: string): Promise<void> {
    const conflict = await this.conflictModel.findById(conflictId).exec();
    if (!conflict) throw new DomainException('NOT_FOUND', 'Conflict not found.', HttpStatus.NOT_FOUND);
    if (conflict.status === 'resolved') throw new DomainException('CONFLICT', 'Already resolved.', HttpStatus.CONFLICT);

    const key = { collegeId: conflict.collegeId, courseId: conflict.courseId, examCode: conflict.examCode, category: conflict.category, year: conflict.year, round: conflict.round };
    const existingCutoff = await this.cutoffModel.findOne(key).exec();
    if (existingCutoff) await this.cutoffModel.findByIdAndUpdate(existingCutoff.id, { closingRank: resolvedValue });
    else await this.cutoffModel.create({ ...key, closingRank: resolvedValue, source: 'manual_admin_entry', verifiedBy: adminId });

    await this.conflictModel.findByIdAndUpdate(conflictId, { status: 'resolved', resolvedValue, resolvedBy: adminId });
  }

  // ── Initial Seed Data ─────────────────────────────────────────────────────────

  private async seedExamsIfEmpty(): Promise<void> {
    const count = await this.examModel.countDocuments().exec();
    if (count > 0) return;

    const year = new Date().getFullYear();
    await this.examModel.insertMany([
      { code: 'KCET', name: 'Karnataka Common Entrance Test', conductingBody: 'Karnataka Examinations Authority', applicableStates: ['Karnataka'], year, isActive: true, rounds: [] },
      { code: 'COMEDK', name: 'Consortium of Medical, Engineering and Dental Colleges of Karnataka', conductingBody: 'COMEDK', applicableStates: ['Karnataka'], year, isActive: true, rounds: [] },
      { code: 'JEE', name: 'Joint Entrance Examination (Main)', conductingBody: 'NTA', applicableStates: ['Karnataka'], year, isActive: true, rounds: [] },
      { code: 'NEET', name: 'National Eligibility cum Entrance Test', conductingBody: 'NTA', applicableStates: ['Karnataka'], year, isActive: true, rounds: [] },
    ]);
  }

  /**
   * Ingests real historical COMEDK cutoffs from comedk_cutoffs_clean.csv.
   */
  public async seedComedkCutoffsIfEmpty(): Promise<number> {
    const count = await this.cutoffModel.countDocuments({ examCode: 'COMEDK' }).exec();
    if (count > 0) return count;

    const csvPath = this.findComedkCsvPath();
    if (!csvPath) return 0;

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length <= 1) return 0;

    const docs: Array<Partial<Cutoff>> = [];
    const header = parseCsvLine(lines[0]);
    const idxYear = header.indexOf('year');
    const idxRound = header.indexOf('round');
    const idxExam = header.indexOf('exam');
    const idxCollegeCode = header.indexOf('college_code');
    const idxCollegeNameNorm = header.indexOf('college_name_normalized');
    const idxCategory = header.indexOf('seat_category');
    const idxCourseRaw = header.indexOf('course_raw');
    const idxCourseNorm = header.indexOf('course_normalized');
    const idxClosingRank = header.indexOf('closing_rank');
    const idxSource = header.indexOf('source_document');

    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      if (row.length < 10) continue;

      const year = parseInt(row[idxYear], 10);
      const closingRank = parseInt(row[idxClosingRank], 10);
      if (isNaN(year) || isNaN(closingRank)) continue;

      const collegeCode = row[idxCollegeCode];
      const courseNorm = row[idxCourseNorm];

      docs.push({
        collegeId: collegeCode,
        courseId: courseNorm,
        examCode: row[idxExam] ? row[idxExam].toUpperCase() : 'COMEDK',
        counsellingAuthority: 'COMEDK',
        year,
        round: row[idxRound],
        category: row[idxCategory],
        collegeCode,
        collegeName: row[idxCollegeNameNorm] || row[idxCollegeCode],
        courseCode: courseNorm,
        courseName: row[idxCourseRaw] || courseNorm,
        openingRank: undefined,
        closingRank,
        state: 'Karnataka',
        collegeType: 'Private',
        source: 'official',
      });
    }

    if (docs.length > 0) {
      await this.cutoffModel.insertMany(docs, { ordered: false }).catch(() => undefined);
    }
    return docs.length;
  }

  private findComedkCsvPath(): string | null {
    const candidates = [
      path.resolve(process.cwd(), '../../files/comedk_cutoffs_clean.csv'),
      path.resolve(process.cwd(), '../files/comedk_cutoffs_clean.csv'),
      path.resolve(process.cwd(), 'files/comedk_cutoffs_clean.csv'),
      'C:/Users/sindh/Downloads/career-compass-ai/files/comedk_cutoffs_clean.csv',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }
}
