import { ScholarshipSavingsService } from '../../src/modules/financial-planning/services/scholarship-savings.service';

describe('ScholarshipSavingsService', () => {
  let scholarshipService: any;
  let service: ScholarshipSavingsService;

  beforeEach(() => {
    scholarshipService = { getMatched: jest.fn() };
    service = new ScholarshipSavingsService(scholarshipService);
  });

  it('returns a zeroed result without calling getMatched for an unauthenticated caller', async () => {
    const result = await service.getEstimatedSavings(undefined, 400000);
    expect(result).toEqual({ scholarships: [], totalEstimatedSavings: 0 });
    expect(scholarshipService.getMatched).not.toHaveBeenCalled();
  });

  it('sums matched scholarships against the given fee base', async () => {
    scholarshipService.getMatched.mockResolvedValue([
      { name: 'A', awardAmount: { type: 'fixed', value: 20000 } },
      { name: 'B', awardAmount: { type: 'percentage', value: 10 } },
    ]);
    const result = await service.getEstimatedSavings('user-1', 400000);
    expect(result.totalEstimatedSavings).toBe(60000); // 20,000 + 10% of 400,000
    expect(scholarshipService.getMatched).toHaveBeenCalledWith('user-1');
  });

  it('returns an empty result when the user has no matched scholarships', async () => {
    scholarshipService.getMatched.mockResolvedValue([]);
    const result = await service.getEstimatedSavings('user-1', 400000);
    expect(result.totalEstimatedSavings).toBe(0);
  });
});
