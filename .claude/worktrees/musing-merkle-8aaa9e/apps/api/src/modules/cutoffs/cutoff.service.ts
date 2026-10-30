import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Exam, ExamDocument } from './models/exam.model';
import { Cutoff, CutoffConflict, CutoffDocument, CutoffConflictDocument } from './models/cutoff.model';
import { CollegeRepository } from '../colleges/repositories/college.repository';
import { DomainException } from '../../common/filters/domain.exception';
import { HttpStatus } from '@nestjs/common';
import { NOTIFICATION_EVENTS } from '../notifications/events/notification.events';

export interface CutoffKey { collegeId: string; courseId: string; examCode: string; category: string; year: number; round: number; }
export interface BulkRow extends CutoffKey { openingRank?: number; closingRank: number; seatsAvailable?: number; }
export interface BulkReport { totalRows: number; accepted: number; rejected: number; conflictsCreated: number; rejectedRows: Array<{ row: number; reason: string }>; }

// Karnataka KCET/NEET vertical-reservation categories (COMEDK has none — a
// private-consortium merit exam, single 'GM' list). Multipliers are a
// documented heuristic (relaxed categories admit at a numerically larger —
// i.e. less competitive — closing rank than General), used only to
// auto-generate a demonstrable multi-year, multi-category cutoff dataset
// for colleges/courses that don't have real historical data on file; they
// are not sourced from official KEA/NTA cutoff data.
const SEED_CATEGORY_MULTIPLIER: Record<string, number> = {
  GM: 1.0, EWS: 1.1, '2A': 1.3, '2B': 1.4, '3A': 1.5, '3B': 1.6, 'Cat-1': 1.8, SC: 2.5, ST: 3.2,
};
const SEED_KCET_CATEGORIES = ['GM', 'SC', 'ST', 'Cat-1', '2A', '2B', '3A', '3B'];
const SEED_NEET_CATEGORIES = [...SEED_KCET_CATEGORIES, 'EWS'];
const SEED_YEAR_MULTIPLIER: Record<number, number> = { 2024: 1.0, 2025: 0.95 };

@Injectable()
export class CutoffService implements OnModuleInit {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<ExamDocument>,
    @InjectModel(Cutoff.name) private readonly cutoffModel: Model<CutoffDocument>,
    @InjectModel(CutoffConflict.name) private readonly conflictModel: Model<CutoffConflictDocument>,
    private readonly collegeRepo: CollegeRepository,
    private readonly events: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seedExamsIfEmpty();
      await this.seedCutoffsIfEmpty();
    } catch {
      // Ignore seed error if DB is unreachable in offline mode (matches CollegeService's seed pattern).
    }
  }

  // ── Exams ────────────────────────────────────────────────────────────────────
  async examExists(code: string): Promise<boolean> {
    return !!(await this.examModel.exists({ code: code.toUpperCase(), isActive: true }));
  }

  getActiveExams() { return this.examModel.find({ isActive: true }).exec(); }

  /** Latest active exam record (with its round timeline) for a code — used
   * by the Wishlist module's Admission Tracking view. Returns null rather
   * than throwing when the exam isn't found, since callers (e.g. a saved
   * college whose accepted exam has no seeded schedule yet) treat "no
   * tracking data available" as a normal, displayable state. */
  async getExamRounds(examCode: string): Promise<ExamDocument | null> {
    return this.examModel.findOne({ code: examCode.toUpperCase(), isActive: true }).sort({ year: -1 }).exec();
  }

  // ── Cutoff Trend ─────────────────────────────────────────────────────────────
  async getTrend(collegeId: string, courseId: string, examCode: string, category: string): Promise<CutoffDocument[]> {
    if (!(await this.collegeRepo.exists(collegeId))) {
      throw new DomainException('NOT_FOUND', `College "${collegeId}" not found.`, HttpStatus.NOT_FOUND);
    }
    return this.cutoffModel.find({ collegeId, courseId, examCode, category }).sort({ year: 1, round: 1 }).exec();
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

  // ── Initial seed data (mirrors CollegeService.seedInitialCollegesIfEmpty) ────

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
   * Auto-generates a multi-year, multi-category cutoff history for every
   * seeded college/course from its `cutoffRankSummary` baseline — without
   * this, the Admission Probability Predictor would have zero historical
   * data to compute against on a fresh database (the real KEA/NTA cutoff
   * archive isn't available to seed from). See SEED_CATEGORY_MULTIPLIER's
   * doc comment for the heuristic used.
   */
  private async seedCutoffsIfEmpty(): Promise<void> {
    const count = await this.cutoffModel.countDocuments().exec();
    if (count > 0) return;

    const { results: colleges } = await this.collegeRepo.search({ page: 1, limit: 500 });
    if (colleges.length === 0) return; // colleges not seeded yet on this boot — nothing to derive rows from

    const rows: Array<Partial<Cutoff>> = [];

    for (const college of colleges) {
      for (const course of college.courses) {
        const baseline = course.cutoffRankSummary ?? 5000;
        for (const examCode of course.examsAccepted) {
          const categories = examCode === 'COMEDK' ? ['GM']
            : examCode === 'KCET' ? SEED_KCET_CATEGORIES
            : examCode === 'NEET' ? SEED_NEET_CATEGORIES
            : [];

          for (const category of categories) {
            for (const year of [2024, 2025]) {
              const closingRank = Math.max(
                1,
                Math.round(baseline * (SEED_CATEGORY_MULTIPLIER[category] ?? 1) * (SEED_YEAR_MULTIPLIER[year] ?? 1)),
              );
              rows.push({
                collegeId: college.id, courseId: course.courseId, examCode, year, round: 1, category,
                openingRank: Math.max(1, Math.round(closingRank * 0.15)),
                closingRank, seatsAvailable: course.intake, source: 'official',
              });
            }
          }
        }
      }
    }

    if (rows.length > 0) {
      await this.cutoffModel.insertMany(rows, { ordered: false }).catch(() => undefined);
    }
  }
}
