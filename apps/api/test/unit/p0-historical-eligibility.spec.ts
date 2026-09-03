import { PredictionService, HistoricalEligibilityDto } from '../../src/modules/predictions/services/prediction.service';
import { classifyPortfolio } from '../../src/modules/predictions/utils/prediction-math.util';

describe('P0 Historical Eligibility & Portfolio Assessment', () => {
  let cutoffService: any;
  let userRepo: any;
  let collegeRepo: any;
  let scholarshipService: any;
  let events: any;
  let predictionModel: any;
  let service: PredictionService;

  beforeEach(() => {
    cutoffService = { getTrend: jest.fn() };
    userRepo = { findById: jest.fn() };
    collegeRepo = { findById: jest.fn() };
    scholarshipService = { getMatched: jest.fn() };
    events = { emit: jest.fn() };
    predictionModel = { findOne: jest.fn(), findOneAndUpdate: jest.fn(), find: jest.fn() };

    service = new PredictionService(
      predictionModel,
      userRepo,
      collegeRepo,
      cutoffService,
      scholarshipService,
      events,
      { predictML: jest.fn() } as any,
    );
  });

  it('1. returns HISTORICALLY_ELIGIBLE when rank is clearly better than cutoff', async () => {
    cutoffService.getTrend.mockResolvedValue([
      { collegeId: 'E001', courseId: 'CSE', examCode: 'COMEDK', category: 'GM', year: 2024, round: 'All Rounds', closingRank: 10000, collegeName: 'Acharya IT', courseName: 'Computer Science' },
    ]);

    const dto: HistoricalEligibilityDto = {
      exam: 'COMEDK',
      rank: 5000,
      category: 'GM',
      collegeCode: 'E001',
      course: 'CSE',
    };

    const res = await service.getHistoricalEligibility(dto);
    expect(res.status).toBe('HISTORICALLY_ELIGIBLE');
    expect(res.studentRank).toBe(5000);
    expect(res.historicalClosingRank).toBe(10000);
    expect(res.rankMargin).toBe(5000);
    expect(res.portfolioClassification).toBe('SAFE');
  });

  it('2. returns HISTORICALLY_ELIGIBLE when rank is exactly equal to cutoff', async () => {
    cutoffService.getTrend.mockResolvedValue([
      { collegeId: 'E001', courseId: 'CSE', examCode: 'COMEDK', category: 'GM', year: 2024, round: 'All Rounds', closingRank: 5000, collegeName: 'Acharya IT', courseName: 'Computer Science' },
    ]);

    const dto: HistoricalEligibilityDto = {
      exam: 'COMEDK',
      rank: 5000,
      category: 'GM',
      collegeCode: 'E001',
      course: 'CSE',
    };

    const res = await service.getHistoricalEligibility(dto);
    expect(res.status).toBe('HISTORICALLY_ELIGIBLE');
    expect(res.rankMargin).toBe(0);
    expect(res.portfolioClassification).toBe('TARGET');
  });

  it('3. returns HISTORICALLY_NOT_ELIGIBLE when rank is worse than cutoff', async () => {
    cutoffService.getTrend.mockResolvedValue([
      { collegeId: 'E001', courseId: 'CSE', examCode: 'COMEDK', category: 'GM', year: 2024, round: 'All Rounds', closingRank: 5000, collegeName: 'Acharya IT', courseName: 'Computer Science' },
    ]);

    const dto: HistoricalEligibilityDto = {
      exam: 'COMEDK',
      rank: 7000,
      category: 'GM',
      collegeCode: 'E001',
      course: 'CSE',
    };

    const res = await service.getHistoricalEligibility(dto);
    expect(res.status).toBe('HISTORICALLY_NOT_ELIGIBLE');
    expect(res.rankMargin).toBe(-2000);
    expect(res.portfolioClassification).toBe('OUTSIDE_HISTORICAL_RANGE');
  });

  it('4. returns INSUFFICIENT_DATA when cutoff dataset has no matching records', async () => {
    cutoffService.getTrend.mockResolvedValue([]);

    const dto: HistoricalEligibilityDto = {
      exam: 'COMEDK',
      rank: 5000,
      category: 'GM',
      collegeCode: 'UNKNOWN_COLLEGE',
      course: 'UNKNOWN_COURSE',
    };

    const res = await service.getHistoricalEligibility(dto);
    expect(res.status).toBe('INSUFFICIENT_DATA');
    expect(res.historicalClosingRank).toBeNull();
    expect(res.portfolioClassification).toBe('INSUFFICIENT_DATA');
  });

  it('5. classifies ratio 1.10 as DREAM', async () => {
    cutoffService.getTrend.mockResolvedValue([
      { collegeId: 'E001', courseId: 'CSE', examCode: 'COMEDK', category: 'GM', year: 2024, round: 'All Rounds', closingRank: 5000 },
    ]);

    const dto: HistoricalEligibilityDto = {
      exam: 'COMEDK',
      rank: 5500,
      category: 'GM',
      collegeCode: 'E001',
      course: 'CSE',
    };

    const res = await service.getHistoricalEligibility(dto);
    expect(res.status).toBe('HISTORICALLY_NOT_ELIGIBLE');
    expect(res.portfolioClassification).toBe('DREAM');
  });
});
