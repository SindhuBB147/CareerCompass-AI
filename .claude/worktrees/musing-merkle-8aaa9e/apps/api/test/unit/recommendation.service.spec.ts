import { EligibilityEngineService } from '../../src/modules/scholarships/services/eligibility-engine.service';
import { RecommendationService } from '../../src/modules/scholarships/services/recommendation.service';
import { Scholarship, ScholarshipDocument } from '../../src/modules/scholarships/models/scholarship.model';

function makeScholarship(id: string, eligibility: Partial<Scholarship['eligibility']>): ScholarshipDocument {
  return {
    id, _id: id, name: `Scholarship ${id}`,
    eligibility: { categories: [], states: [], exams: [], applicableCourses: [], minorityOnly: false, pwdOnly: false, requiredReservations: [], ...eligibility },
  } as unknown as ScholarshipDocument;
}

describe('RecommendationService', () => {
  let service: RecommendationService;
  beforeEach(() => { service = new RecommendationService(new EligibilityEngineService()); });

  const profile = {
    category: 'SC',
    domicileState: 'Karnataka',
    familyIncomeAnnual: 200000,
    examProfiles: [{ examCode: 'KCET', rank: 5000 }],
    preferences: { preferredCourses: ['Computer Science'] },
  };

  it('excludes scholarships the student is not eligible for', () => {
    const scholarships = [makeScholarship('a', { categories: ['OBC'] })]; // wrong category → not_eligible
    const recs = service.recommend(profile, scholarships);
    expect(recs).toHaveLength(0);
  });

  it('tags a fully-matching scholarship as highly_recommended', () => {
    const scholarships = [makeScholarship('a', { categories: ['SC'], applicableCourses: ['Computer Science'] })];
    const recs = service.recommend(profile, scholarships);
    expect(recs[0].tier).toBe('highly_recommended');
    expect(recs[0].tierLabel).toBe('Highly Recommended');
  });

  it('tags a partially-known profile as eligible or almost_eligible, never highly_recommended', () => {
    const scholarships = [makeScholarship('a', { categories: ['SC'], maxIncome: 300000, minAcademicPercent: 90 })];
    const recs = service.recommend(profile, scholarships); // no academic.twelfthPercentage on profile -> unknown
    expect(recs).toHaveLength(1);
    expect(['eligible', 'almost_eligible']).toContain(recs[0].tier);
  });

  it('sorts recommendations by descending score', () => {
    const scholarships = [
      makeScholarship('low', { categories: ['SC'], minAcademicPercent: 95 }), // unknown academic -> lower score
      makeScholarship('high', { categories: ['SC'] }), // nothing unresolved -> higher score
    ];
    const recs = service.recommend(profile, scholarships);
    expect(recs[0].scholarship.id).toBe('high');
    expect(recs[0].eligibility.score).toBeGreaterThanOrEqual(recs[1].eligibility.score);
  });

  it('respects the limit parameter', () => {
    const scholarships = [
      makeScholarship('a', { categories: ['SC'] }),
      makeScholarship('b', { categories: ['SC'] }),
      makeScholarship('c', { categories: ['SC'] }),
    ];
    const recs = service.recommend(profile, scholarships, 2);
    expect(recs).toHaveLength(2);
  });
});
