import { HostelLivingService } from '../../src/modules/financial-planning/services/hostel-living.service';

function makeCollege(overrides: any = {}) {
  return {
    id: 'col-1',
    city: 'Bengaluru',
    feeBreakdown: { hostelFee: 60000, messFee: 36000 },
    hostelInfo: { boysHostel: true, girlsHostel: true, capacity: 2000, roomTypes: ['Double Sharing'], messDetails: 'Multi-cuisine mess.', amenities: ['WiFi'] },
    ...overrides,
  };
}

describe('HostelLivingService', () => {
  let collegeService: any;
  let service: HostelLivingService;

  beforeEach(() => {
    collegeService = { getDetail: jest.fn() };
    service = new HostelLivingService(collegeService);
  });

  it('surfaces real DB-backed hostelInfo and fees when collegeId is given', async () => {
    collegeService.getDetail.mockResolvedValue(makeCollege());
    const result = await service.getHostelLivingEstimate({ collegeId: 'col-1', accommodationType: 'hostel' } as any);
    expect(result.dbHostelInfo).not.toBeNull();
    expect(result.dbHostelInfo!.hostelFeePerYear).toBe(60000);
    expect(result.dbHostelInfo!.messFeePerYear).toBe(36000);
    expect(result.dbHostelInfo!.roomTypes).toEqual(['Double Sharing']);
    expect(collegeService.getDetail).toHaveBeenCalledWith('col-1');
  });

  it('returns null dbHostelInfo for a pure city-tier estimate when no collegeId is given', async () => {
    const result = await service.getHostelLivingEstimate({ city: 'Mysuru', accommodationType: 'pg' } as any);
    expect(result.dbHostelInfo).toBeNull();
    expect(result.estimate.cityTier).toBe('tier2');
    expect(collegeService.getDetail).not.toHaveBeenCalled();
  });

  it('resolves the estimate city from the college when collegeId is given, overriding any passed city', async () => {
    collegeService.getDetail.mockResolvedValue(makeCollege({ city: 'Bengaluru' }));
    const result = await service.getHostelLivingEstimate({ collegeId: 'col-1', city: 'SomeOtherCity', accommodationType: 'hostel' } as any);
    expect(result.estimate.cityTier).toBe('tier1'); // Bengaluru, not the passed city
  });

  it('returns null dbHostelInfo when the college has no hostelInfo on file', async () => {
    collegeService.getDetail.mockResolvedValue(makeCollege({ hostelInfo: undefined }));
    const result = await service.getHostelLivingEstimate({ collegeId: 'col-1', accommodationType: 'hostel' } as any);
    expect(result.dbHostelInfo).toBeNull();
  });
});
