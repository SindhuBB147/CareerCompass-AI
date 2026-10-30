import { PredictionService } from '../../src/modules/predictions/services/prediction.service';

function makeCollege(overrides: any = {}) {
  return {
    id: 'col-1',
    city: 'Bengaluru',
    courses: [
      { courseId: 'CSE', durationYears: 4, feePerYear: 220000, ...overrides.course },
    ],
    placementSummary: [
      { year: 2024, highestPackage: 40, averagePackage: 12, medianPackage: 10, placementPercentage: 90 }, // LPA
    ],
    ...overrides.college,
  };
}

describe('PredictionService.getRoi', () => {
  let model: any;
  let userRepo: any;
  let collegeRepo: any;
  let cutoffService: any;
  let scholarshipService: any;
  let service: PredictionService;

  beforeEach(() => {
    model = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    userRepo = {};
    collegeRepo = { findById: jest.fn() };
    cutoffService = {};
    scholarshipService = { getMatched: jest.fn().mockResolvedValue([]) };
    service = new PredictionService(model, userRepo, collegeRepo, cutoffService, scholarshipService, { emit: jest.fn() } as any);
  });

  it('fixes the LPA/rupee unit bug: paybackYears lands in a sane low range, not ~100,000', async () => {
    collegeRepo.findById.mockResolvedValue(makeCollege());
    const result = await service.getRoi('user-1', 'col-1', 'CSE');
    // netCost ≈ (220,000*4) + livingCost(~4yr) ≈ ~1.15M; medianPackage 10 LPA = ₹1,000,000/yr
    // paybackYears should be roughly 1-2, absolutely not ~106,250 (the pre-fix bug).
    expect(result.paybackYears).toBeGreaterThan(0);
    expect(result.paybackYears).toBeLessThan(20);
  });

  it('sources durationYears from the course, not a hardcoded 4', async () => {
    collegeRepo.findById.mockResolvedValue(makeCollege({ course: { durationYears: 5, feePerYear: 12000 } })); // MBBS-like
    const result = await service.getRoi('user-1', 'col-1', 'CSE');
    expect(result.durationYears).toBe(5);
    expect(result.tuitionAndFees).toBe(12000 * 5);
  });

  it('converts LPA placement packages to rupees', async () => {
    collegeRepo.findById.mockResolvedValue(makeCollege());
    const result = await service.getRoi('user-1', 'col-1', 'CSE');
    expect(result.projectedPackageAnnual).toBe(10 * 100000);
    expect(result.highestPackageAnnual).toBe(40 * 100000);
  });

  it('deducts matched scholarship savings from netCost', async () => {
    collegeRepo.findById.mockResolvedValue(makeCollege());

    scholarshipService.getMatched.mockResolvedValue([]);
    const withoutScholarship = await service.getRoi('user-1', 'col-1', 'CSE');

    scholarshipService.getMatched.mockResolvedValue([
      { name: 'Test Scholarship', awardAmount: { type: 'fixed', value: 100000 } },
    ]);
    const withScholarship = await service.getRoi('user-2', 'col-1', 'CSE');

    expect(withScholarship.scholarshipSavings).toBe(100000);
    expect(withScholarship.netCost).toBe(withoutScholarship.netCost - 100000);
  });

  it('computes roiPercent via the 10-year 8% CAGR closed-form geometric series', async () => {
    collegeRepo.findById.mockResolvedValue(makeCollege());
    const result = await service.getRoi('user-1', 'col-1', 'CSE');
    const cumulativeEarnings = result.projectedPackageAnnual * ((Math.pow(1.08, 10) - 1) / 0.08);
    const expectedRoi = Math.round(((cumulativeEarnings - result.netCost) / result.netCost) * 100);
    expect(result.roiPercent).toBe(expectedRoi);
  });

  it('returns a cached roiEstimate without re-fetching the college when a fresh cache entry exists', async () => {
    const cachedEstimate = {
      totalInvestment: 1, tuitionAndFees: 1, livingCost: 1, scholarshipSavings: 0, netCost: 1,
      projectedPackageAnnual: 1000000, highestPackageAnnual: 2000000, placementPercentage: 90,
      paybackYears: 1, roiPercent: 50, durationYears: 4,
    };
    model.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ roiEstimate: cachedEstimate, expiresAt: new Date(Date.now() + 1000 * 60) }),
    });
    const result = await service.getRoi('user-1', 'col-1', 'CSE');
    expect(result).toEqual(cachedEstimate);
    expect(collegeRepo.findById).not.toHaveBeenCalled();
  });

  it('falls back to a default projected package when there is no placement data', async () => {
    collegeRepo.findById.mockResolvedValue(makeCollege({ college: { placementSummary: [] } }));
    const result = await service.getRoi('user-1', 'col-1', 'CSE');
    expect(result.projectedPackageAnnual).toBe(5 * 100000); // documented fallback: 5 LPA
    expect(result.placementPercentage).toBeNull();
  });
});
