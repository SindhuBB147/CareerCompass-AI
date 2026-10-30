import { EligibilityEngineService, EligibilityProfile } from '../../src/modules/scholarships/services/eligibility-engine.service';
import { Scholarship } from '../../src/modules/scholarships/models/scholarship.model';

type ScholarshipInput = Pick<Scholarship, 'eligibility'>;

function makeScholarship(overrides: Partial<Scholarship['eligibility']> = {}): ScholarshipInput {
  return {
    eligibility: {
      categories: [], states: [], exams: [], applicableCourses: [],
      minorityOnly: false, pwdOnly: false, requiredReservations: [],
      ...overrides,
    } as Scholarship['eligibility'],
  };
}

const FULL_PROFILE: EligibilityProfile = {
  category: 'SC',
  domicileState: 'Karnataka',
  gender: 'female',
  familyIncomeAnnual: 200000,
  examProfiles: [{ examCode: 'KCET', rank: 5000 }],
  categoryReservation: { reservationCategory: 'SC', horizontalReservations: ['Minority', 'PwD'] },
  academic: { twelfthPercentage: 88 },
  preferences: { preferredCourses: ['Computer Science'] },
};

describe('EligibilityEngineService', () => {
  let engine: EligibilityEngineService;
  beforeEach(() => { engine = new EligibilityEngineService(); });

  it('returns "eligible" when every required check passes', () => {
    const scholarship = makeScholarship({ categories: ['SC'], states: ['Karnataka'], exams: ['KCET'], maxIncome: 300000 });
    const report = engine.evaluate(FULL_PROFILE, scholarship);
    expect(report.verdict).toBe('eligible');
    expect(report.score).toBeGreaterThanOrEqual(90);
  });

  it('returns "not_eligible" when a required check fails (wrong category)', () => {
    const scholarship = makeScholarship({ categories: ['OBC'] });
    const report = engine.evaluate(FULL_PROFILE, scholarship);
    expect(report.verdict).toBe('not_eligible');
    expect(report.reasons.failed.length).toBeGreaterThan(0);
  });

  it('returns "not_eligible" when income exceeds the cap', () => {
    const scholarship = makeScholarship({ maxIncome: 100000 });
    const report = engine.evaluate(FULL_PROFILE, scholarship);
    expect(report.verdict).toBe('not_eligible');
  });

  it('returns "partially_eligible" when a required field is missing from the profile', () => {
    const scholarship = makeScholarship({ maxIncome: 300000 });
    const profileWithoutIncome: EligibilityProfile = { ...FULL_PROFILE, familyIncomeAnnual: undefined };
    const report = engine.evaluate(profileWithoutIncome, scholarship);
    expect(report.verdict).toBe('partially_eligible');
    expect(report.reasons.unknown.some(r => r.toLowerCase().includes('income'))).toBe(true);
  });

  it('normalizes GM <-> General category aliasing', () => {
    const scholarship = makeScholarship({ categories: ['General'] });
    const gmProfile: EligibilityProfile = { ...FULL_PROFILE, category: undefined, categoryReservation: { reservationCategory: 'GM' } };
    const report = engine.evaluate(gmProfile, scholarship);
    expect(report.checks.find(c => c.key === 'category')?.result).toBe('pass');
  });

  it('passes rank checks within bounds and fails outside them', () => {
    const withinScholarship = makeScholarship({ exams: ['KCET'], maxRank: 10000 });
    expect(engine.evaluate(FULL_PROFILE, withinScholarship).checks.find(c => c.key === 'rank')?.result).toBe('pass');

    const outOfRangeScholarship = makeScholarship({ exams: ['KCET'], maxRank: 1000 });
    expect(engine.evaluate(FULL_PROFILE, outOfRangeScholarship).checks.find(c => c.key === 'rank')?.result).toBe('fail');
  });

  it('treats gender-specific scholarships correctly', () => {
    const femaleOnly = makeScholarship({ genderSpecific: 'female' });
    expect(engine.evaluate(FULL_PROFILE, femaleOnly).checks.find(c => c.key === 'gender')?.result).toBe('pass');

    const maleOnly = makeScholarship({ genderSpecific: 'male' });
    expect(engine.evaluate(FULL_PROFILE, maleOnly).checks.find(c => c.key === 'gender')?.result).toBe('fail');
  });

  it('treats an empty horizontalReservations array as "unknown" for minority/PwD checks, not a fail', () => {
    const minorityOnly = makeScholarship({ minorityOnly: true });
    const profileNoReservations: EligibilityProfile = { ...FULL_PROFILE, categoryReservation: { reservationCategory: 'SC', horizontalReservations: [] } };
    expect(engine.evaluate(profileNoReservations, minorityOnly).checks.find(c => c.key === 'minority')?.result).toBe('unknown');
  });

  it('never fails the course check — only "pass" (bonus) or "unknown"', () => {
    const scholarship = makeScholarship({ applicableCourses: ['MBBS'] });
    const report = engine.evaluate(FULL_PROFILE, scholarship); // profile has "Computer Science", not MBBS
    expect(report.checks.find(c => c.key === 'course')?.result).not.toBe('fail');
  });

  it('scores a fully-matching course higher than a non-matching one', () => {
    const matching = makeScholarship({ categories: ['SC'], applicableCourses: ['Computer Science'] });
    const nonMatching = makeScholarship({ categories: ['SC'], applicableCourses: ['MBBS'] });
    const matchScore = engine.evaluate(FULL_PROFILE, matching).score;
    const nonMatchScore = engine.evaluate(FULL_PROFILE, nonMatching).score;
    expect(matchScore).toBeGreaterThan(nonMatchScore);
  });

  it('is open to everyone when eligibility has no restrictions at all', () => {
    const openScholarship = makeScholarship();
    const emptyProfile: EligibilityProfile = {};
    const report = engine.evaluate(emptyProfile, openScholarship);
    expect(report.verdict).toBe('eligible');
    expect(report.score).toBe(100);
  });
});
