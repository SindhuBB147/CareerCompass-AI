import { CollegeService } from '../../src/modules/colleges/services/college.service';
import { CollegeRepository } from '../../src/modules/colleges/repositories/college.repository';
import { CollegeNotFoundException, SomeCollegesNotFoundException } from '../../src/modules/colleges/colleges.exceptions';

describe('CollegeService', () => {
  let repo: jest.Mocked<Pick<CollegeRepository,
    'search' | 'findById' | 'findByIds' | 'getFacets' | 'addReview'>>;
  let service: CollegeService;

  beforeEach(() => {
    repo = {
      search: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      getFacets: jest.fn(),
      addReview: jest.fn(),
    };
    service = new CollegeService(repo as unknown as CollegeRepository, { emit: jest.fn() } as any);
  });

  describe('search', () => {
    it('computes totalPages from totalResults and limit', async () => {
      repo.search.mockResolvedValue({ results: [{ id: '1' }] as any, totalResults: 45 });
      const out = await service.search({ page: 2, limit: 20 } as any);
      expect(out.totalPages).toBe(3);
      expect(out.page).toBe(2);
      expect(out.totalResults).toBe(45);
    });

    it('never returns fewer than 1 total page, even with zero results', async () => {
      repo.search.mockResolvedValue({ results: [], totalResults: 0 });
      const out = await service.search({ page: 1, limit: 20 } as any);
      expect(out.totalPages).toBe(1);
    });
  });

  describe('getDetail', () => {
    it('throws CollegeNotFoundException when the college does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getDetail('missing')).rejects.toThrow(CollegeNotFoundException);
    });

    it('returns the college when found', async () => {
      repo.findById.mockResolvedValue({ id: 'rvce', name: 'RVCE' } as any);
      await expect(service.getDetail('rvce')).resolves.toEqual({ id: 'rvce', name: 'RVCE' });
    });
  });

  describe('compare', () => {
    it('throws SomeCollegesNotFoundException listing exactly the missing ids', async () => {
      repo.findByIds.mockResolvedValue([{ id: 'a', slug: 'a' }] as any);
      await expect(service.compare({ collegeIds: ['a', 'b', 'c'] })).rejects.toThrow(SomeCollegesNotFoundException);
    });

    it('returns all colleges when every id is found', async () => {
      const colleges = [{ id: 'a', slug: 'a' }, { id: 'b', slug: 'b' }];
      repo.findByIds.mockResolvedValue(colleges as any);
      await expect(service.compare({ collegeIds: ['a', 'b'] })).resolves.toEqual(colleges);
    });
  });

  describe('getFacets', () => {
    it('delegates to the repository with the given exam code', async () => {
      const facets = { cities: ['Bengaluru'], districts: [], collegeTypes: [], naacGrades: [], branches: [], disciplines: [] };
      repo.getFacets.mockResolvedValue(facets);
      await expect(service.getFacets('NEET')).resolves.toEqual(facets);
      expect(repo.getFacets).toHaveBeenCalledWith('NEET');
    });

    it('delegates with undefined when no exam code is given', async () => {
      repo.getFacets.mockResolvedValue({ cities: [], districts: [], collegeTypes: [], naacGrades: [], branches: [], disciplines: [] });
      await service.getFacets();
      expect(repo.getFacets).toHaveBeenCalledWith(undefined);
    });
  });

  describe('addReview', () => {
    it('throws CollegeNotFoundException when the college does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.addReview('missing', { userName: 'A', rating: 5, comment: 'Great' })).rejects.toThrow(CollegeNotFoundException);
    });

    it('defaults sub-ratings to the overall rating when not provided', async () => {
      repo.findById.mockResolvedValue({ id: 'rvce' } as any);
      repo.addReview.mockResolvedValue({} as any);
      const review = await service.addReview('rvce', { userName: 'Ananya', rating: 4, comment: 'Solid' });
      expect(review.academicsRating).toBe(4);
      expect(review.placementRating).toBe(4);
      expect(review.verifiedStudent).toBe(true);
    });
  });
});
