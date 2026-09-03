import { Injectable } from '@nestjs/common';
import { Scholarship } from '../models/scholarship.model';

export type CheckResult = 'pass' | 'fail' | 'unknown';
export type EligibilityVerdict = 'eligible' | 'partially_eligible' | 'not_eligible';

export interface EligibilityCheck {
  key: string;
  label: string;
  result: CheckResult;
  message: string;
}

export interface EligibilityReport {
  verdict: EligibilityVerdict;
  score: number; // 0-100, used by the recommendation engine to rank
  checks: EligibilityCheck[];
  reasons: { passed: string[]; failed: string[]; unknown: string[] };
}

/** The subset of a student's profile the eligibility engine reads. Matches
 * UserDocument's shape structurally — a plain object satisfying this is
 * enough, so tests don't need a full Mongoose document. */
export interface EligibilityProfile {
  category?: string;
  domicileState?: string;
  gender?: string;
  familyIncomeAnnual?: number;
  examProfiles?: Array<{ examCode: string; rank?: number }>;
  categoryReservation?: { reservationCategory?: string; horizontalReservations?: string[] };
  academic?: { tenthPercentage?: number; twelfthPercentage?: number; currentQualification?: string };
  preferences?: { preferredCourses?: string[] };
  aiPersonalization?: { careerGoal?: string };
}

type ScholarshipInput = Pick<Scholarship, 'eligibility'>;

const GM_ALIASES = new Set(['gm', 'general']);

function normalizeCategory(cat?: string): string | undefined {
  if (!cat) return undefined;
  const lower = cat.toLowerCase();
  return GM_ALIASES.has(lower) ? 'gm' : lower;
}

const WEIGHTS = {
  exam: 20, category: 20, income: 15, state: 10, rank: 10,
  gender: 5, minority: 5, pwd: 5, requiredReservations: 5, academicPercent: 5,
};
const COURSE_BONUS = 10;

@Injectable()
export class EligibilityEngineService {
  evaluate(profile: EligibilityProfile, scholarship: ScholarshipInput): EligibilityReport {
    const e = scholarship.eligibility;
    const checks: EligibilityCheck[] = [
      this.checkExam(profile, e),
      this.checkCategory(profile, e),
      this.checkIncome(profile, e),
      this.checkState(profile, e),
      this.checkRank(profile, e),
      this.checkGender(profile, e),
      this.checkMinority(profile, e),
      this.checkPwd(profile, e),
      this.checkRequiredReservations(profile, e),
      this.checkAcademicPercent(profile, e),
    ];
    const courseCheck = this.checkCourse(profile, e);

    const hasFail = checks.some(c => c.result === 'fail');
    const hasUnknown = checks.some(c => c.result === 'unknown');
    const verdict: EligibilityVerdict = hasFail ? 'not_eligible' : hasUnknown ? 'partially_eligible' : 'eligible';

    let earned = 0;
    let possible = 0;
    for (const check of checks) {
      const weight = WEIGHTS[check.key as keyof typeof WEIGHTS] ?? 0;
      possible += weight;
      if (check.result === 'pass') earned += weight;
      else if (check.result === 'unknown') earned += weight * 0.4;
    }
    if (courseCheck.result === 'pass') earned += COURSE_BONUS;
    possible += COURSE_BONUS;
    const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;

    const allChecks = [...checks, courseCheck];
    return {
      verdict,
      score,
      checks: allChecks,
      reasons: {
        passed: allChecks.filter(c => c.result === 'pass').map(c => c.message),
        failed: allChecks.filter(c => c.result === 'fail').map(c => c.message),
        unknown: allChecks.filter(c => c.result === 'unknown').map(c => c.message),
      },
    };
  }

  private checkExam(p: EligibilityProfile, e: Scholarship['eligibility']): EligibilityCheck {
    const key = 'exam', label = 'Entrance Exam';
    if (!e.exams?.length) return { key, label, result: 'pass', message: 'Open to all entrance exams.' };
    const studentExams = (p.examProfiles ?? []).map(ep => ep.examCode.toUpperCase());
    if (studentExams.length === 0) {
      return { key, label, result: 'unknown', message: `Add your entrance exam (${e.exams.join('/')}) to your profile to confirm eligibility.` };
    }
    const matched = studentExams.some(code => e.exams.includes(code));
    return matched
      ? { key, label, result: 'pass', message: `Your exam matches (${e.exams.join(', ')}).` }
      : { key, label, result: 'fail', message: `Only open to ${e.exams.join('/')} candidates.` };
  }

  private checkCategory(p: EligibilityProfile, e: Scholarship['eligibility']): EligibilityCheck {
    const key = 'category', label = 'Category / Reservation';
    if (!e.categories?.length) return { key, label, result: 'pass', message: 'Open to all categories.' };
    const eligibleSet = new Set(e.categories.map(normalizeCategory));
    const candidates = [normalizeCategory(p.category), normalizeCategory(p.categoryReservation?.reservationCategory)].filter(Boolean);
    if (candidates.length === 0) {
      return { key, label, result: 'unknown', message: `Add your category to your profile to confirm eligibility (accepted: ${e.categories.join(', ')}).` };
    }
    const matched = candidates.some(c => eligibleSet.has(c as string));
    return matched
      ? { key, label, result: 'pass', message: `Your category matches (${e.categories.join(', ')}).` }
      : { key, label, result: 'fail', message: `Only open to: ${e.categories.join(', ')}.` };
  }

  private checkIncome(p: EligibilityProfile, e: Scholarship['eligibility']): EligibilityCheck {
    const key = 'income', label = 'Family Income';
    if (e.maxIncome === undefined && e.minIncome === undefined) {
      return { key, label, result: 'pass', message: 'No income restriction.' };
    }
    if (p.familyIncomeAnnual === undefined) {
      return { key, label, result: 'unknown', message: `Add your annual family income to confirm eligibility (limit: ₹${e.maxIncome?.toLocaleString('en-IN') ?? '—'}).` };
    }
    const aboveMin = e.minIncome === undefined || p.familyIncomeAnnual >= e.minIncome;
    const belowMax = e.maxIncome === undefined || p.familyIncomeAnnual <= e.maxIncome;
    return aboveMin && belowMax
      ? { key, label, result: 'pass', message: 'Your family income is within the eligible range.' }
      : { key, label, result: 'fail', message: `Family income must be ${e.maxIncome ? `below ₹${e.maxIncome.toLocaleString('en-IN')}` : `above ₹${e.minIncome?.toLocaleString('en-IN')}`}.` };
  }

  private checkState(p: EligibilityProfile, e: Scholarship['eligibility']): EligibilityCheck {
    const key = 'state', label = 'Domicile State';
    const states = (e.states ?? []).map(s => s.toLowerCase());
    if (states.length === 0 || states.includes('all india')) {
      return { key, label, result: 'pass', message: 'Open to students from any state.' };
    }
    if (!p.domicileState) {
      return { key, label, result: 'unknown', message: `Add your domicile state to your profile to confirm eligibility (${e.states.join(', ')}).` };
    }
    const matched = states.includes(p.domicileState.toLowerCase());
    return matched
      ? { key, label, result: 'pass', message: `Domicile matches (${e.states.join(', ')}).` }
      : { key, label, result: 'fail', message: `Only open to residents of: ${e.states.join(', ')}.` };
  }

  private checkRank(p: EligibilityProfile, e: Scholarship['eligibility']): EligibilityCheck {
    const key = 'rank', label = 'Entrance Rank';
    if (e.minRank === undefined && e.maxRank === undefined) {
      return { key, label, result: 'pass', message: 'No rank cutoff.' };
    }
    const relevantProfile = (p.examProfiles ?? []).find(ep => e.exams?.includes(ep.examCode.toUpperCase())) ?? (p.examProfiles ?? [])[0];
    if (!relevantProfile?.rank) {
      return { key, label, result: 'unknown', message: 'Add your entrance rank to your profile to confirm rank eligibility.' };
    }
    const aboveMin = e.minRank === undefined || relevantProfile.rank >= e.minRank;
    const belowMax = e.maxRank === undefined || relevantProfile.rank <= e.maxRank;
    return aboveMin && belowMax
      ? { key, label, result: 'pass', message: 'Your rank is within the required range.' }
      : { key, label, result: 'fail', message: `Requires rank ${e.maxRank ? `within top ${e.maxRank.toLocaleString('en-IN')}` : `above ${e.minRank?.toLocaleString('en-IN')}`}.` };
  }

  private checkGender(p: EligibilityProfile, e: Scholarship['eligibility']): EligibilityCheck {
    const key = 'gender', label = 'Gender';
    if (!e.genderSpecific) return { key, label, result: 'pass', message: 'Open to all genders.' };
    if (!p.gender) return { key, label, result: 'unknown', message: `Add your gender to your profile to confirm eligibility (${e.genderSpecific} only).` };
    return p.gender.toLowerCase() === e.genderSpecific.toLowerCase()
      ? { key, label, result: 'pass', message: `Open to ${e.genderSpecific} students.` }
      : { key, label, result: 'fail', message: `Only open to ${e.genderSpecific} students.` };
  }

  private checkMinority(p: EligibilityProfile, e: Scholarship['eligibility']): EligibilityCheck {
    const key = 'minority', label = 'Minority Status';
    if (!e.minorityOnly) return { key, label, result: 'pass', message: 'No minority-status requirement.' };
    const reservations = p.categoryReservation?.horizontalReservations ?? [];
    if (reservations.length === 0) return { key, label, result: 'unknown', message: 'Confirm your minority status in your profile to check eligibility.' };
    return reservations.includes('Minority')
      ? { key, label, result: 'pass', message: 'Minority status confirmed.' }
      : { key, label, result: 'fail', message: 'Only open to students from a recognized religious/linguistic minority.' };
  }

  private checkPwd(p: EligibilityProfile, e: Scholarship['eligibility']): EligibilityCheck {
    const key = 'pwd', label = 'PwD Status';
    if (!e.pwdOnly) return { key, label, result: 'pass', message: 'No disability-status requirement.' };
    const reservations = p.categoryReservation?.horizontalReservations ?? [];
    if (reservations.length === 0) return { key, label, result: 'unknown', message: 'Confirm your PwD status in your profile to check eligibility.' };
    return reservations.includes('PwD')
      ? { key, label, result: 'pass', message: 'PwD status confirmed.' }
      : { key, label, result: 'fail', message: 'Only open to Persons with Disabilities (PwD).' };
  }

  private checkRequiredReservations(p: EligibilityProfile, e: Scholarship['eligibility']): EligibilityCheck {
    const key = 'requiredReservations', label = 'Additional Reservation';
    const required = e.requiredReservations ?? [];
    if (required.length === 0) return { key, label, result: 'pass', message: 'No additional reservation requirement.' };
    const held = p.categoryReservation?.horizontalReservations ?? [];
    if (held.length === 0) return { key, label, result: 'unknown', message: `Confirm your reservation status (${required.join(', ')}) in your profile.` };
    const allHeld = required.every(r => held.includes(r));
    return allHeld
      ? { key, label, result: 'pass', message: `Reservation requirements met (${required.join(', ')}).` }
      : { key, label, result: 'fail', message: `Requires: ${required.join(', ')}.` };
  }

  private checkAcademicPercent(p: EligibilityProfile, e: Scholarship['eligibility']): EligibilityCheck {
    const key = 'academicPercent', label = 'Academic Percentage';
    if (e.minAcademicPercent === undefined) return { key, label, result: 'pass', message: 'No minimum marks requirement.' };
    const percent = p.academic?.twelfthPercentage ?? p.academic?.tenthPercentage;
    if (percent === undefined) return { key, label, result: 'unknown', message: `Add your academic percentage to confirm eligibility (min ${e.minAcademicPercent}%).` };
    return percent >= e.minAcademicPercent
      ? { key, label, result: 'pass', message: `Meets the minimum ${e.minAcademicPercent}% requirement.` }
      : { key, label, result: 'fail', message: `Requires a minimum of ${e.minAcademicPercent}% marks.` };
  }

  /** Informational only — course matching is fuzzy, so it never fails a
   * student out of a scholarship, only adds a bonus to the ranking score. */
  private checkCourse(p: EligibilityProfile, e: Scholarship['eligibility']): EligibilityCheck {
    const key = 'course', label = 'Course / Discipline';
    if (!e.applicableCourses?.length) return { key, label, result: 'pass', message: 'Open to all courses.' };
    const haystack = [
      ...(p.preferences?.preferredCourses ?? []),
      p.academic?.currentQualification,
      p.aiPersonalization?.careerGoal,
    ].filter(Boolean).join(' ').toLowerCase();
    if (!haystack) return { key, label, result: 'unknown', message: `Applicable to: ${e.applicableCourses.join(', ')}.` };
    const matched = e.applicableCourses.some(c => haystack.includes(c.toLowerCase()));
    return matched
      ? { key, label, result: 'pass', message: `Matches your course interest (${e.applicableCourses.join(', ')}).` }
      : { key, label, result: 'unknown', message: `Applicable to: ${e.applicableCourses.join(', ')}.` };
  }
}
