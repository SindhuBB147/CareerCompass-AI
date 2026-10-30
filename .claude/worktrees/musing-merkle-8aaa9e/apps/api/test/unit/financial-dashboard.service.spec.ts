import { FinancialDashboardService } from '../../src/modules/financial-planning/services/financial-dashboard.service';

const FEE_BREAKDOWN = {
  durationYears: 4,
  yearly: [
    {
      year: 1,
      lineItems: [
        { label: 'Tuition Fee', amount: 144000, source: 'estimated', recurring: true },
        { label: 'Development Fee', amount: 20000, source: 'estimated', recurring: true },
        { label: 'Laboratory Fee', amount: 16000, source: 'estimated', recurring: true },
        { label: 'Library Fee', amount: 10000, source: 'estimated', recurring: true },
        { label: 'Examination Fee', amount: 10000, source: 'estimated', recurring: true },
        { label: 'Hostel Fee', amount: 60000, source: 'db', recurring: true },
      ],
      total: 260000,
    },
    { year: 2, lineItems: [], total: 200000 },
    { year: 3, lineItems: [], total: 200000 },
    { year: 4, lineItems: [], total: 200000 },
  ],
  semesterWise: [],
  totalProgramCost: 860000,
  totalProgramCostWithLaptop: 860000,
};

const ROI_RESULT = {
  totalInvestment: 1000000, tuitionAndFees: 800000, livingCost: 200000, scholarshipSavings: 0, netCost: 1000000,
  projectedPackageAnnual: 1000000, highestPackageAnnual: 2000000, placementPercentage: 90,
  paybackYears: 1, roiPercent: 400, durationYears: 4,
};

describe('FinancialDashboardService.getDashboard', () => {
  let feeBreakdownService: any;
  let hostelLivingService: any;
  let scholarshipSavingsService: any;
  let predictionService: any;
  let collegeService: any;
  let service: FinancialDashboardService;

  const baseDto = { collegeId: 'col-1', courseId: 'CSE', hostelRequired: true };

  beforeEach(() => {
    feeBreakdownService = { getFeeBreakdown: jest.fn().mockResolvedValue(FEE_BREAKDOWN) };
    hostelLivingService = { getHostelLivingEstimate: jest.fn().mockResolvedValue({ dbHostelInfo: null, estimate: {} }) };
    scholarshipSavingsService = { getEstimatedSavings: jest.fn().mockResolvedValue({ scholarships: [], totalEstimatedSavings: 0 }) };
    predictionService = { getRoi: jest.fn().mockResolvedValue(ROI_RESULT) };
    collegeService = { compare: jest.fn() };
    service = new FinancialDashboardService(feeBreakdownService, hostelLivingService, scholarshipSavingsService, predictionService, collegeService);
  });

  it('skips hostelLivingService when hostelRequired is true', async () => {
    await service.getDashboard('user-1', baseDto as any);
    expect(hostelLivingService.getHostelLivingEstimate).not.toHaveBeenCalled();
  });

  it('calls hostelLivingService when hostelRequired is false', async () => {
    await service.getDashboard('user-1', { ...baseDto, hostelRequired: false } as any);
    expect(hostelLivingService.getHostelLivingEstimate).toHaveBeenCalled();
  });

  it('computes academicFeeTotal from only the academic-split line items, passed to scholarshipSavingsService', async () => {
    await service.getDashboard('user-1', baseDto as any);
    // 144000+20000+16000+10000+10000 = 200000 (Year 1 academic split only, excludes Hostel Fee)
    expect(scholarshipSavingsService.getEstimatedSavings).toHaveBeenCalledWith('user-1', 200000);
  });

  it('netFinancialBurden = totalProgramCost - scholarshipSavings - familyContribution (excludes currentSavings)', async () => {
    scholarshipSavingsService.getEstimatedSavings.mockResolvedValue({ scholarships: [], totalEstimatedSavings: 60000 });
    const result = await service.getDashboard('user-1', { ...baseDto, familyContribution: 100000, currentSavings: 200000 } as any);
    expect(result.netFinancialBurden).toBe(860000 - 60000 - 100000);
  });

  it('loanAmountNeeded additionally subtracts currentSavings (unlike netFinancialBurden)', async () => {
    scholarshipSavingsService.getEstimatedSavings.mockResolvedValue({ scholarships: [], totalEstimatedSavings: 60000 });
    const result = await service.getDashboard('user-1', { ...baseDto, familyContribution: 100000, currentSavings: 200000 } as any);
    expect(result.loanAmountNeeded).toBe(860000 - 60000 - 100000 - 200000);
    expect(result.loanAmountNeeded).toBeLessThan(result.netFinancialBurden);
  });

  it('estimatedEmi is 0 when loanAmountNeeded is 0 (fully covered by savings/contribution/scholarships)', async () => {
    scholarshipSavingsService.getEstimatedSavings.mockResolvedValue({ scholarships: [], totalEstimatedSavings: 860000 });
    const result = await service.getDashboard('user-1', baseDto as any);
    expect(result.loanAmountNeeded).toBe(0);
    expect(result.estimatedEmi).toBe(0);
  });

  it('estimatedEmi is positive when a loan is needed', async () => {
    const result = await service.getDashboard('user-1', baseDto as any);
    expect(result.loanAmountNeeded).toBeGreaterThan(0);
    expect(result.estimatedEmi).toBeGreaterThan(0);
  });

  it('exposes expectedSalaryAfterGraduation from roi.projectedPackageAnnual', async () => {
    const result = await service.getDashboard('user-1', baseDto as any);
    expect(result.expectedSalaryAfterGraduation).toBe(ROI_RESULT.projectedPackageAnnual);
  });

  it('gracefully zeroes scholarship/ROI sections for an unauthenticated caller instead of throwing', async () => {
    const result = await service.getDashboard(undefined, baseDto as any);
    expect(predictionService.getRoi).not.toHaveBeenCalled();
    expect(result.roi.roiPercent).toBe(0);
    expect(result.roi.projectedPackageAnnual).toBe(0);
  });
});

describe('FinancialDashboardService.getComparison', () => {
  let feeBreakdownService: any;
  let hostelLivingService: any;
  let scholarshipSavingsService: any;
  let predictionService: any;
  let collegeService: any;
  let service: FinancialDashboardService;

  function makeCollege(id: string, name: string) {
    return { id, name, courses: [{ courseId: 'CSE', name: 'Computer Science & Engineering', durationYears: 4 }] };
  }

  beforeEach(() => {
    feeBreakdownService = { getFeeBreakdown: jest.fn().mockResolvedValue(FEE_BREAKDOWN) };
    hostelLivingService = { getHostelLivingEstimate: jest.fn().mockResolvedValue({ dbHostelInfo: null, estimate: {} }) };
    scholarshipSavingsService = { getEstimatedSavings: jest.fn().mockResolvedValue({ scholarships: [], totalEstimatedSavings: 0 }) };
    predictionService = { getRoi: jest.fn().mockResolvedValue(ROI_RESULT) };
    collegeService = { compare: jest.fn().mockResolvedValue([makeCollege('col-1', 'College A'), makeCollege('col-2', 'College B')]) };
    service = new FinancialDashboardService(feeBreakdownService, hostelLivingService, scholarshipSavingsService, predictionService, collegeService);
  });

  it('produces one row per requested college+course pair for 2 colleges', async () => {
    const result = await service.getComparison('user-1', {
      hostelRequired: true,
      collegeCourseIds: [{ collegeId: 'col-1', courseId: 'CSE' }, { collegeId: 'col-2', courseId: 'CSE' }],
    } as any);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].collegeName).toBe('College A');
    expect(result.rows[1].collegeName).toBe('College B');
  });

  it('produces one row per pair for 4 colleges', async () => {
    collegeService.compare.mockResolvedValue([
      makeCollege('col-1', 'A'), makeCollege('col-2', 'B'), makeCollege('col-3', 'C'), makeCollege('col-4', 'D'),
    ]);
    const result = await service.getComparison('user-1', {
      hostelRequired: true,
      collegeCourseIds: [
        { collegeId: 'col-1', courseId: 'CSE' }, { collegeId: 'col-2', courseId: 'CSE' },
        { collegeId: 'col-3', courseId: 'CSE' }, { collegeId: 'col-4', courseId: 'CSE' },
      ],
    } as any);
    expect(result.rows).toHaveLength(4);
  });

  it('reuses CollegeService.compare() for the fetch — does not re-implement college fetching', async () => {
    await service.getComparison('user-1', {
      hostelRequired: true,
      collegeCourseIds: [{ collegeId: 'col-1', courseId: 'CSE' }, { collegeId: 'col-2', courseId: 'CSE' }],
    } as any);
    expect(collegeService.compare).toHaveBeenCalledWith({ collegeIds: ['col-1', 'col-2'] });
  });

  it('splits totalCost into totalFees + hostelCost using the fee-breakdown line items, not re-derived math', async () => {
    const result = await service.getComparison('user-1', {
      hostelRequired: true,
      collegeCourseIds: [{ collegeId: 'col-1', courseId: 'CSE' }],
    } as any);
    const row = result.rows[0];
    expect(row.hostelCost).toBe(60000); // 'Hostel Fee' line item in the FEE_BREAKDOWN fixture
    expect(row.totalCost).toBe(FEE_BREAKDOWN.totalProgramCost);
    expect(row.totalFees).toBe(FEE_BREAKDOWN.totalProgramCost - 60000);
  });

  it('carries placement/ROI figures through from the same getDashboard composition', async () => {
    const result = await service.getComparison('user-1', {
      hostelRequired: true,
      collegeCourseIds: [{ collegeId: 'col-1', courseId: 'CSE' }],
    } as any);
    expect(result.rows[0].avgPackage).toBe(ROI_RESULT.projectedPackageAnnual);
    expect(result.rows[0].highestPackage).toBe(ROI_RESULT.highestPackageAnnual);
    expect(result.rows[0].roiPercent).toBe(ROI_RESULT.roiPercent);
  });
});
