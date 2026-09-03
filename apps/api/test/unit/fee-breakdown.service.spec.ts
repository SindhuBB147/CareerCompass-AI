import { FeeBreakdownService } from '../../src/modules/financial-planning/services/fee-breakdown.service';
import { CourseNotFoundException } from '../../src/modules/colleges/colleges.exceptions';

function makeCollege(overrides: any = {}) {
  return {
    id: 'col-1',
    city: 'Bengaluru',
    feeBreakdown: { tuitionFee: 200000, hostelFee: 60000, messFee: 36000, otherCharges: 5000, totalAnnualFee: 301000 },
    courses: [
      { courseId: 'CSE', durationYears: 4, feePerYear: 220000 },
      { courseId: 'NOFE', durationYears: 4, feePerYear: null }, // course with no independent fee — falls back to feeBreakdown.tuitionFee
    ],
    ...overrides,
  };
}

describe('FeeBreakdownService', () => {
  let collegeService: any;
  let service: FeeBreakdownService;

  beforeEach(() => {
    collegeService = { getDetail: jest.fn() };
    service = new FeeBreakdownService(collegeService);
  });

  it('throws CourseNotFoundException when the course does not exist on the college', async () => {
    collegeService.getDetail.mockResolvedValue(makeCollege());
    await expect(service.getFeeBreakdown({ collegeId: 'col-1', courseId: 'NOPE', hostelRequired: true } as any))
      .rejects.toThrow(CourseNotFoundException);
  });

  it('uses course.feePerYear as the academic fee when present', async () => {
    collegeService.getDetail.mockResolvedValue(makeCollege());
    const result = await service.getFeeBreakdown({ collegeId: 'col-1', courseId: 'CSE', hostelRequired: true } as any);
    const tuitionLine = result.yearly[0].lineItems.find((li: any) => li.label === 'Tuition Fee')!;
    expect(tuitionLine.amount).toBe(Math.round(220000 * 0.72));
  });

  it('falls back to college.feeBreakdown.tuitionFee when course.feePerYear is null', async () => {
    collegeService.getDetail.mockResolvedValue(makeCollege());
    const result = await service.getFeeBreakdown({ collegeId: 'col-1', courseId: 'NOFE', hostelRequired: true } as any);
    const tuitionLine = result.yearly[0].lineItems.find((li: any) => li.label === 'Tuition Fee')!;
    expect(tuitionLine.amount).toBe(Math.round(200000 * 0.72)); // feeBreakdown.tuitionFee, not totalAnnualFee
  });

  it('uses real DB hostel/mess fees when hostelRequired is true', async () => {
    collegeService.getDetail.mockResolvedValue(makeCollege());
    const result = await service.getFeeBreakdown({ collegeId: 'col-1', courseId: 'CSE', hostelRequired: true } as any);
    const hostelLine = result.yearly[0].lineItems.find((li: any) => li.label === 'Hostel Fee')!;
    expect(hostelLine.amount).toBe(60000);
    expect(hostelLine.source).toBe('db');
  });

  it('uses an estimated living-cost line when hostelRequired is false', async () => {
    collegeService.getDetail.mockResolvedValue(makeCollege());
    const result = await service.getFeeBreakdown({ collegeId: 'col-1', courseId: 'CSE', hostelRequired: false, accommodationType: 'day_scholar' } as any);
    const livingLine = result.yearly[0].lineItems.find((li: any) => li.label === 'Living Expenses (Day Scholar)')!;
    expect(livingLine).toBeDefined();
    expect(livingLine.source).toBe('estimated');
    expect(result.yearly[0].lineItems.find((li: any) => li.label === 'Hostel Fee')).toBeUndefined();
  });
});
