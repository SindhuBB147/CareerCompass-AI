import { SearchAggregatorService } from '../../src/modules/search/services/search-aggregator.service';
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

describe('SearchAggregatorService', () => {
  let collegeRepo: { search: jest.Mock; getFacets: jest.Mock };
  let scholarshipService: { search: jest.Mock };
  let service: SearchAggregatorService;
  const studentContext: StudentContext = {};

  beforeEach(() => {
    collegeRepo = { search: jest.fn().mockResolvedValue({ results: [{ _id: 'c1' }], totalResults: 1 }), getFacets: jest.fn() };
    scholarshipService = { search: jest.fn().mockResolvedValue({ scholarships: [{ _id: 's1' }], totalResults: 1 }) };
    service = new SearchAggregatorService(collegeRepo as any, scholarshipService as any);
  });

  it('maps extracted entities onto CollegeRepository.search filters', async () => {
    const entities = noEntities({ discipline: 'Engineering', city: 'Bengaluru', college_type: 'Government', budget_max: 200_000, nirf_max: 50, hostel_required: true, exam: 'KCET' });
    await service.findCandidateColleges(entities, undefined, studentContext);

    expect(collegeRepo.search).toHaveBeenCalledWith(expect.objectContaining({
      discipline: 'Engineering', city: 'Bengaluru', collegeType: 'Government',
      maxFee: 200_000, maxNirf: 50, hostelAvailable: true, examCode: 'KCET',
    }));
  });

  it('lets explicit filters win over entity-extracted values', async () => {
    const entities = noEntities({ city: 'Bengaluru' });
    await service.findCandidateColleges(entities, { city: 'Mysuru' } as any, studentContext);
    expect(collegeRepo.search).toHaveBeenCalledWith(expect.objectContaining({ city: 'Mysuru' }));
  });

  it('falls back to the student profile exam when no exam entity or filter is given', async () => {
    await service.findCandidateColleges(noEntities(), undefined, { examCode: 'NEET' });
    expect(collegeRepo.search).toHaveBeenCalledWith(expect.objectContaining({ examCode: 'NEET' }));
  });

  it('resolves compare-intent college names via one lookup per name', async () => {
    const results = await service.findCompareTargets(['RV College of Engineering', 'BMS College of Engineering']);
    expect(collegeRepo.search).toHaveBeenCalledTimes(2);
    expect(collegeRepo.search).toHaveBeenNthCalledWith(1, { q: 'RV College of Engineering', page: 1, limit: 1 });
    expect(results).toHaveLength(2);
  });

  it('skips a compare name lookup that fails instead of throwing', async () => {
    collegeRepo.search.mockRejectedValueOnce(new Error('db down'));
    const results = await service.findCompareTargets(['Unknown College']);
    expect(results).toHaveLength(0);
  });

  it('maps category/exam onto ScholarshipService.search filters', async () => {
    const entities = noEntities({ scholarship_focus: true, category: 'SC' });
    await service.findScholarships(entities, { examCode: 'KCET' });
    expect(scholarshipService.search).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'SC', exam: 'KCET', status: 'open', isActive: true }),
      1, 10,
    );
  });

  it('falls back to the student profile category when no category entity is given', async () => {
    await service.findScholarships(noEntities(), { category: 'OBC' });
    expect(scholarshipService.search).toHaveBeenCalledWith(expect.objectContaining({ category: 'OBC' }), 1, 10);
  });
});
