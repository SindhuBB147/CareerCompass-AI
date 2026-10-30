import { CollegeRankingService } from '../../src/modules/search/services/college-ranking.service';
import { SearchEntities } from '../../src/common/ai-client/ai-service.client';
import { StudentContext } from '../../src/common/utils/student-context.util';

function noEntities(overrides: Partial<SearchEntities> = {}): SearchEntities {
  return {
    exam: null, discipline: null, college_type: null, city: null, category: null,
    budget_max: null, nirf_max: null, rank: null, use_profile_rank: false,
    hostel_required: false, placement_focus: false, scholarship_focus: false,
    roi_focus: false, action: null, college_names: [], sort_hint: null,
    ...overrides,
  };
}

function makeCollege(id: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: id,
    name: `College ${id}`,
    city: 'Bengaluru',
    state: 'Karnataka',
    collegeType: 'Government',
    rating: 4.5,
    accreditation: { nirfRank: 100, naac: 'A' },
    feeBreakdown: { totalAnnualFee: 100000 },
    hostelInfo: { boysHostel: true, girlsHostel: true },
    courses: [{ courseId: 'CSE', name: 'CSE', discipline: 'Engineering', examsAccepted: ['KCET'], cutoffRankSummary: 5000 }],
    placementSummary: [{ year: 2024, averagePackage: 800000, highestPackage: 2000000, placementPercentage: 90 }],
    ...overrides,
  } as any;
}

describe('CollegeRankingService', () => {
  let service: CollegeRankingService;
  const studentContext: StudentContext = {};

  beforeEach(() => { service = new CollegeRankingService(); });

  it('returns candidates sorted by descending score', () => {
    const strong = makeCollege('strong', { accreditation: { nirfRank: 5, naac: 'A++' }, rating: 5 });
    const weak = makeCollege('weak', { accreditation: {}, rating: 1 });
    const [first, second] = service.rank([weak, strong], noEntities(), studentContext);
    expect(first.college).toBe(strong);
    expect(second.college).toBe(weak);
  });

  it('scores every candidate a college matching all extracted entities higher than one matching none', () => {
    const matching = makeCollege('match', { city: 'Bengaluru', collegeType: 'Government' });
    const nonMatching = makeCollege('miss', { city: 'Mysuru', collegeType: 'Private' });
    const entities = noEntities({ city: 'Bengaluru', college_type: 'Government', discipline: 'Engineering' });
    const [first] = service.rank([nonMatching, matching], entities, studentContext);
    expect(first.college).toBe(matching);
    expect(first.breakdown.entityMatch).toBe(1);
  });

  it('treats a course with no discipline field as Engineering, matching an Engineering entity filter', () => {
    // Mirrors the same fallback in college.repository.ts / course-matcher.util.ts.
    const college = makeCollege('a', { courses: [{ courseId: 'CSE', name: 'CSE', examsAccepted: ['KCET'], cutoffRankSummary: 5000 }] });
    const entities = noEntities({ discipline: 'Engineering', hostel_required: true });
    const [ranked] = service.rank([college], entities, studentContext);
    expect(ranked.breakdown.entityMatch).toBe(1);
  });

  it('does not zero out entityMatch for missing optional data — pure free text is neutral (0.5)', () => {
    const college = makeCollege('a');
    const [ranked] = service.rank([college], noEntities(), studentContext);
    expect(ranked.breakdown.entityMatch).toBe(0.5);
  });

  it('defaults dataQuality to neutral values when NIRF/rating are absent, never 0', () => {
    const noData = makeCollege('nodata', { accreditation: {}, rating: undefined });
    const [ranked] = service.rank([noData], noEntities(), studentContext);
    expect(ranked.breakdown.dataQuality).toBeGreaterThan(0);
    expect(ranked.breakdown.dataQuality).toBeCloseTo(0.5 * 0.4 + 0.5 * 0.5, 5);
  });

  it('gives colleges explicitly named in a compare query a full actionIntentBoost, tipping otherwise-even candidates', () => {
    // The boost carries a 0.10 formula weight (see WEIGHTS) — a deliberate
    // nudge, not an override of a large dataQuality/personalization gap
    // elsewhere. With two otherwise-identical candidates, the boost alone
    // should decide the ordering.
    const named = makeCollege('named');
    const other = makeCollege('other');
    const ranked = service.rank([other, named], noEntities(), studentContext, { compareBoostIds: new Set(['named']) });
    expect(ranked[0].college).toBe(named);
    expect(ranked[0].breakdown.actionIntentBoost).toBe(1.0);
    expect(ranked[1].breakdown.actionIntentBoost).toBe(0);
  });

  it('gives budget-fitting colleges a higher personalizationFit than over-budget ones', () => {
    const withinBudget = makeCollege('cheap', { feeBreakdown: { totalAnnualFee: 150_000 } });
    const overBudget = makeCollege('expensive', { feeBreakdown: { totalAnnualFee: 900_000 } });
    const entities = noEntities({ budget_max: 200_000 });
    const [first] = service.rank([overBudget, withinBudget], entities, studentContext);
    expect(first.college).toBe(withinBudget);
  });

  it('boosts placement-focused queries toward colleges in the top quartile of average package', () => {
    const highPackage = makeCollege('high-pkg', { placementSummary: [{ year: 2024, averagePackage: 2_000_000, highestPackage: 5_000_000, placementPercentage: 95 }] });
    const lowPackage = makeCollege('low-pkg', { placementSummary: [{ year: 2024, averagePackage: 300_000, highestPackage: 500_000, placementPercentage: 60 }] });
    const entities = noEntities({ placement_focus: true });
    const ranked = service.rank([lowPackage, highPackage], entities, studentContext);
    expect(ranked[0].college).toBe(highPackage);
  });

  it('uses an already-computed admission probability over cutoff-distance when available', () => {
    const college = makeCollege('a', { courses: [{ courseId: 'CSE', name: 'CSE', discipline: 'Engineering', examsAccepted: ['KCET'], cutoffRankSummary: 100 }] });
    const [withHighProb] = service.rank([college], noEntities(), { rank: 50000 }, { admissionProbabilityById: new Map([['a', 90]]) });
    const [withoutProb] = service.rank([college], noEntities(), { rank: 50000 });
    // Cutoff distance (rank 50000 vs cutoff 100) would score very low; the supplied 90% probability should dominate instead.
    expect(withHighProb.breakdown.personalizationFit).toBeGreaterThan(withoutProb.breakdown.personalizationFit);
  });
});
