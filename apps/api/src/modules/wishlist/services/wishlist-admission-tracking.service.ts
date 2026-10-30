import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CutoffService } from '../../cutoffs/cutoff.service';
import { CollegeRepository } from '../../colleges/repositories/college.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { SavedCollegeNotFoundException } from '../wishlist.exceptions';
import { SavedCollegeRepository } from '../repositories/saved-college.repository';
import { CollegeNotFoundException } from '../../colleges/colleges.exceptions';

export interface AdmissionRoundView {
  roundNumber: number;
  name: string;
  choiceFillingStart: Date | null;
  choiceFillingEnd: Date | null;
  cutoffReleaseDate: Date | null;
  reportingDeadline: Date | null;
  status: string;
  isMopUp: boolean;
  isSpot: boolean;
}

export interface AdmissionTrackingView {
  examCode: string | null;
  examName: string | null;
  year: number | null;
  rounds: AdmissionRoundView[];
}

@Injectable()
export class WishlistAdmissionTrackingService {
  constructor(
    private readonly savedCollegeRepo: SavedCollegeRepository,
    private readonly collegeRepo: CollegeRepository,
    private readonly userRepo: UserRepository,
    @Inject(forwardRef(() => CutoffService)) private readonly cutoffService: CutoffService,
  ) {}

  /** Real per-round choice-filling/cutoff-release/reporting timeline for the
   * exam the college accepts (preferring one the student has a rank for) —
   * no fabricated "document verification" milestone, since that isn't in
   * the underlying Exam/ExamRound data model (see cutoffs/models/exam.model.ts). */
  async getTracking(userId: string, collegeId: string): Promise<AdmissionTrackingView> {
    const saved = await this.savedCollegeRepo.find(userId, collegeId);
    if (!saved) throw new SavedCollegeNotFoundException();

    const college = await this.collegeRepo.findById(collegeId);
    if (!college) throw new CollegeNotFoundException();

    const acceptedExams = Array.from(new Set(college.courses.flatMap(c => c.examsAccepted)));
    if (acceptedExams.length === 0) return { examCode: null, examName: null, year: null, rounds: [] };

    const user = await this.userRepo.findById(userId);
    const studentExams = new Set((user?.examProfiles ?? []).map(e => e.examCode));
    const examCode = acceptedExams.find(code => studentExams.has(code)) ?? acceptedExams[0];

    const exam = await this.cutoffService.getExamRounds(examCode);
    if (!exam) return { examCode, examName: null, year: null, rounds: [] };

    return {
      examCode: exam.code,
      examName: exam.name,
      year: exam.year,
      rounds: exam.rounds.map(r => ({
        roundNumber: r.roundNumber,
        name: r.name ?? `Round ${r.roundNumber}`,
        choiceFillingStart: r.choiceFillingStart ?? null,
        choiceFillingEnd: r.choiceFillingEnd ?? null,
        cutoffReleaseDate: r.cutoffReleaseDate ?? null,
        reportingDeadline: r.reportingDeadline ?? null,
        status: r.status,
        isMopUp: (r.name ?? '').toLowerCase().includes('mop'),
        isSpot: (r.name ?? '').toLowerCase().includes('spot'),
      })),
    };
  }
}
