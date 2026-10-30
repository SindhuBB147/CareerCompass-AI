import { PredictionService } from '../../src/modules/predictions/services/prediction.service';
import { DomainException } from '../../src/common/filters/domain.exception';

describe('PredictionService evidence safeguards', () => {
  let service: PredictionService;
  let model: any;
  let cutoffService: any;
  let userRepo: any;

  beforeEach(() => {
    model = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
    };
    userRepo = {
      findById: jest.fn().mockResolvedValue({
        examProfiles: [{ examCode: 'KCET', rank: 33000, categoryUsed: 'GM' }],
        category: 'GM',
      }),
    };
    cutoffService = {
      getTrend: jest.fn(),
    };
    service = new PredictionService(
      model,
      userRepo,
      {} as any,
      cutoffService,
      {} as any,
      {} as any,
    );
  });

  it('refuses to estimate from multiple rounds belonging to only one year', async () => {
    model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({
      modelVersion: 'v1.0', expiresAt: new Date(Date.now() + 60_000),
      probabilityBand: 'Safe', probabilityPercent: 98,
    }) });
    cutoffService.getTrend.mockResolvedValue([
      { year: 2023, round: 1, closingRank: 10000 },
      { year: 2023, round: 2, closingRank: 12000 },
      { year: 2023, round: 3, closingRank: 14000 },
    ]);

    await expect(service.getPrediction('user-1', 'college-1', 'CSE', 'KCET'))
      .rejects.toThrow(DomainException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not impose a fixed 2% floor on far-rank results', () => {
    const result = (service as any).computeProbability(1_000_000, 1_000, 3);
    expect(result.band).toBe('Reach');
    expect(result.percent).toBe(0);
  });
});
