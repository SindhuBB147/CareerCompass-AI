import { PredictionEngineService } from '../../src/modules/predictions/services/prediction-engine.service';
import { PredictCollegesDto } from '../../src/modules/predictions/dto/predict-colleges.dto';
import { DomainException } from '../../src/common/filters/domain.exception';

function makeCourse(overrides: any = {}) {
  return {
    courseId: 'CSE', name: 'Computer Science & Engineering', degreeType: 'B.E.',
    durationYears: 4, intake: 100, examsAccepted: ['KCET', 'COMEDK'],
    feePerYear: 200000, eligibility: '', cutoffRankSummary: 1000, discipline: 'Engineering',
    ...overrides,
  };
}

function makeCollege(overrides: any = {}) {
  return {
    id: overrides.id ?? 'col-1',
    name: overrides.name ?? 'Test College',
    bannerImage: 'https://example.com/img.jpg',
    accreditation: { nirfRank: overrides.nirfRank },
    city: overrides.city ?? 'Bengaluru',
    district: overrides.district,
    collegeType: overrides.collegeType ?? 'Autonomous',
    feeBreakdown: { totalAnnualFee: 200000 },
    hostelInfo: { boysHostel: true, girlsHostel: true },
    placementSummary: [{ year: 2024, averagePackage: 10, medianPackage: 8, highestPackage: 20, placementPercentage: 90 }],
    courses: overrides.courses ?? [makeCourse()],
  };
}

describe('PredictionEngineService', () => {
  let collegeRepo: any;
  let cutoffService: any;
  let scholarshipService: any;
  let aiServiceClient: any;
  let engine: PredictionEngineService;

  const baseDto: PredictCollegesDto = {
    examCode: 'KCET', rank: 1000, category: 'GM', discipline: 'Engineering',
    courseSelections: ['Computer Science & Engineering (CSE)'],
    sortBy: 'nirf', page: 1, limit: 20,
  };

  beforeEach(() => {
    collegeRepo = { findByExamAndDiscipline: jest.fn() };
    cutoffService = { getTrend: jest.fn() };
    scholarshipService = { countMatchingForProfile: jest.fn().mockResolvedValue(2) };
    aiServiceClient = { predictML: jest.fn() };
    engine = new PredictionEngineService(collegeRepo, cutoffService, scholarshipService, aiServiceClient);
  });

  function trendFor(closingRanks: number[], startYear = 2023) {
    return closingRanks.map((closingRank, i) => ({ year: startYear + i, closingRank }));
  }

  describe('validation', () => {
    it('throws when KCET category is missing', async () => {
      collegeRepo.findByExamAndDiscipline.mockResolvedValue([]);
      const dto = { ...baseDto, category: undefined };
      await expect(engine.predictColleges(dto)).rejects.toThrow(DomainException);
    });

    it('throws when category is invalid for the exam', async () => {
      const dto = { ...baseDto, category: 'OBC' };
      await expect(engine.predictColleges(dto)).rejects.toThrow(/not a valid category for KCET/);
    });

    it('throws when KCET discipline is missing', async () => {
      const dto = { ...baseDto, discipline: undefined };
      await expect(engine.predictColleges(dto)).rejects.toThrow(/Discipline is required/);
    });

    it('throws when KCET discipline is unrecognized', async () => {
      const dto = { ...baseDto, discipline: 'Astrology' };
      await expect(engine.predictColleges(dto)).rejects.toThrow(/not a recognized KCET discipline/);
    });

    it('throws when Engineering discipline has no course selections', async () => {
      const dto = { ...baseDto, courseSelections: [] };
      await expect(engine.predictColleges(dto)).rejects.toThrow(/Select at least one preferred course/);
    });

    it('throws when COMEDK/NEET have no course selections', async () => {
      const dto = { ...baseDto, examCode: 'COMEDK' as const, discipline: undefined, category: undefined, courseSelections: [] };
      await expect(engine.predictColleges(dto)).rejects.toThrow(/Select at least one preferred course/);
    });
  });

  describe('ranking order', () => {
    it('sorts primarily by NIRF ascending, with unranked colleges last', async () => {
      const colleges = [
        makeCollege({ id: 'c-unranked', name: 'Unranked College', nirfRank: undefined }),
        makeCollege({ id: 'c-100', name: 'Rank 100 College', nirfRank: 100 }),
        makeCollege({ id: 'c-50', name: 'Rank 50 College', nirfRank: 50 }),
      ];
      collegeRepo.findByExamAndDiscipline.mockResolvedValue(colleges);
      cutoffService.getTrend.mockResolvedValue(trendFor([1000, 1000]));

      const result = await engine.predictColleges(baseDto);

      expect(result.results.map(r => r.collegeName)).toEqual([
        'Rank 50 College', 'Rank 100 College', 'Unranked College',
      ]);
    });

    it('breaks NIRF ties by probability descending', async () => {
      const colleges = [
        makeCollege({ id: 'c-a', name: 'College A (far rank)', nirfRank: 50 }),
        makeCollege({ id: 'c-b', name: 'College B (close rank)', nirfRank: 50 }),
      ];
      collegeRepo.findByExamAndDiscipline.mockResolvedValue(colleges);
      cutoffService.getTrend.mockImplementation((collegeId: string) =>
        Promise.resolve(collegeId === 'c-a' ? trendFor([200, 200]) : trendFor([5000, 5000])),
      );

      const result = await engine.predictColleges(baseDto);
      // Student rank 1000: College B's cutoff (5000) is far more favorable than College A's (200).
      expect(result.results[0].collegeName).toBe('College B (close rank)');
    });

    it('sortBy=probability ranks by probability first, NIRF second', async () => {
      const colleges = [
        makeCollege({ id: 'c-lowrank-highprob', name: 'Low NIRF, High Prob', nirfRank: 200 }),
        makeCollege({ id: 'c-highrank-lowprob', name: 'High NIRF, Low Prob', nirfRank: 10 }),
      ];
      collegeRepo.findByExamAndDiscipline.mockResolvedValue(colleges);
      cutoffService.getTrend.mockImplementation((collegeId: string) =>
        Promise.resolve(collegeId === 'c-lowrank-highprob' ? trendFor([5000, 5000]) : trendFor([100, 100])),
      );

      const result = await engine.predictColleges({ ...baseDto, sortBy: 'probability' });
      expect(result.results[0].collegeName).toBe('Low NIRF, High Prob');
    });
  });

  describe('horizontal reservation bonus', () => {
    it('applies a capped bonus to the final percent', async () => {
      const college = makeCollege({ id: 'c-1', nirfRank: 50 });
      collegeRepo.findByExamAndDiscipline.mockResolvedValue([college]);
      cutoffService.getTrend.mockResolvedValue(trendFor([2000, 2000]));

      const withoutBonus = await engine.predictColleges(baseDto);
      const withBonus = await engine.predictColleges({
        ...baseDto,
        horizontalReservations: ['Rural Quota', 'Kannada Medium', 'NCC', 'Sports', 'PwD'], // 5 * 2 = 10, capped at 8
      });

      const base = withoutBonus.results[0].probabilityPercent;
      const bonused = withBonus.results[0].probabilityPercent;
      expect(withBonus.results[0].rationale.horizontalReservationBonus).toBe(8);
      expect(bonused).toBeLessThanOrEqual(base + 8);
      expect(bonused).toBeGreaterThanOrEqual(base);
    });

    it('does not apply a bonus when there is no cutoff data (trendingClosingRank = 0)', async () => {
      const college = makeCollege({ id: 'c-1', nirfRank: 50 });
      collegeRepo.findByExamAndDiscipline.mockResolvedValue([college]);
      cutoffService.getTrend.mockResolvedValue([]);

      const result = await engine.predictColleges({ ...baseDto, horizontalReservations: ['Rural Quota'] });
      expect(result.results[0].rationale.horizontalReservationBonus).toBe(0);
      expect(result.results[0].probabilityLevel).toBe('Very Low');
    });
  });

  describe('filters', () => {
    it('filters by collegeType', async () => {
      const colleges = [
        makeCollege({ id: 'c-gov', name: 'Gov College', collegeType: 'Government', nirfRank: 50 }),
        makeCollege({ id: 'c-priv', name: 'Private College', collegeType: 'Private', nirfRank: 60 }),
      ];
      collegeRepo.findByExamAndDiscipline.mockResolvedValue(colleges);
      cutoffService.getTrend.mockResolvedValue(trendFor([1000, 1000]));

      const result = await engine.predictColleges({ ...baseDto, filters: { collegeType: 'Government' } });
      expect(result.results.map(r => r.collegeName)).toEqual(['Gov College']);
    });

    it('filters by maxNirfRank', async () => {
      const colleges = [
        makeCollege({ id: 'c-50', name: 'Rank 50', nirfRank: 50 }),
        makeCollege({ id: 'c-300', name: 'Rank 300', nirfRank: 300 }),
      ];
      collegeRepo.findByExamAndDiscipline.mockResolvedValue(colleges);
      cutoffService.getTrend.mockResolvedValue(trendFor([1000, 1000]));

      const result = await engine.predictColleges({ ...baseDto, filters: { maxNirfRank: 100 } });
      expect(result.results.map(r => r.collegeName)).toEqual(['Rank 50']);
    });

    it('filters by minProbabilityPercent', async () => {
      const colleges = [
        makeCollege({ id: 'c-a', name: 'Strong Match', nirfRank: 50 }),
        makeCollege({ id: 'c-b', name: 'Weak Match', nirfRank: 60 }),
      ];
      collegeRepo.findByExamAndDiscipline.mockResolvedValue(colleges);
      cutoffService.getTrend.mockImplementation((collegeId: string) =>
        Promise.resolve(collegeId === 'c-a' ? trendFor([2000, 2000]) : trendFor([50, 50])),
      );

      const result = await engine.predictColleges({ ...baseDto, filters: { minProbabilityPercent: 50 } });
      expect(result.results.map(r => r.collegeName)).toEqual(['Strong Match']);
    });
  });

  describe('pagination', () => {
    it('paginates the sorted, filtered result set', async () => {
      const colleges = Array.from({ length: 5 }, (_, i) => makeCollege({ id: `c-${i}`, name: `College ${i}`, nirfRank: i + 1 }));
      collegeRepo.findByExamAndDiscipline.mockResolvedValue(colleges);
      cutoffService.getTrend.mockResolvedValue(trendFor([1000, 1000]));

      const result = await engine.predictColleges({ ...baseDto, limit: 2, page: 2 });
      expect(result.totalResults).toBe(5);
      expect(result.totalPages).toBe(3);
      expect(result.results.map(r => r.collegeName)).toEqual(['College 2', 'College 3']);
    });
  });

  describe('empty match handling', () => {
    it('returns an empty result set with a guiding insight when nothing matches', async () => {
      collegeRepo.findByExamAndDiscipline.mockResolvedValue([makeCollege({ courses: [makeCourse({ name: 'Civil Engineering' })] })]);

      const result = await engine.predictColleges(baseDto); // asks for CSE, college only has Civil
      expect(result.results).toEqual([]);
      expect(result.insights[0]).toMatch(/No colleges currently match/);
    });
  });

  describe('KCET non-Engineering discipline', () => {
    it('matches purely by discipline, ignoring courseSelections', async () => {
      const pharmacyCollege = makeCollege({
        id: 'c-pharma', name: 'Pharmacy College', nirfRank: 200,
        courses: [makeCourse({ courseId: 'BPHARM', name: 'Bachelor of Pharmacy', degreeType: 'B.Pharm', discipline: 'Pharmacy', examsAccepted: ['KCET'] })],
      });
      collegeRepo.findByExamAndDiscipline.mockResolvedValue([pharmacyCollege]);
      cutoffService.getTrend.mockResolvedValue(trendFor([25000, 25000]));

      const result = await engine.predictColleges({
        ...baseDto, discipline: 'B-Pharma', courseSelections: undefined, rank: 20000,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].collegeName).toBe('Pharmacy College');
    });
  });

  describe('scholarships field', () => {
    it('attaches the student-level scholarship count to every result', async () => {
      const colleges = [makeCollege({ id: 'c-1', nirfRank: 50 })];
      collegeRepo.findByExamAndDiscipline.mockResolvedValue(colleges);
      cutoffService.getTrend.mockResolvedValue(trendFor([1000, 1000]));
      scholarshipService.countMatchingForProfile.mockResolvedValue(3);

      const result = await engine.predictColleges(baseDto);
      expect(result.results[0].scholarshipsCount).toBe(3);
    });
  });

  describe('ML Integration & Forecast Status', () => {
    it('returns FORECAST_NOT_AVAILABLE and null predicted rank when data points < 4 years', async () => {
      const colleges = [makeCollege({ id: 'c-1', nirfRank: 50 })];
      collegeRepo.findByExamAndDiscipline.mockResolvedValue(colleges);
      cutoffService.getTrend.mockResolvedValue(trendFor([1000, 1000])); // 2 data points

      const result = await engine.predictColleges(baseDto);
      expect(result.results[0].forecastStatus).toBe('FORECAST_NOT_AVAILABLE');
      expect(result.results[0].predictedClosingRank).toBeNull();
      expect(aiServiceClient.predictML).not.toHaveBeenCalled();
    });

    it('returns AVAILABLE and predicted rank when data points >= 4 years', async () => {
      const colleges = [makeCollege({ id: 'c-1', nirfRank: 50 })];
      collegeRepo.findByExamAndDiscipline.mockResolvedValue(colleges);
      cutoffService.getTrend.mockResolvedValue(trendFor([1000, 1200, 1100, 1300])); // 4 data points
      aiServiceClient.predictML.mockResolvedValue({ success: true, predictedClosingRank: 1250 });

      const result = await engine.predictColleges(baseDto);
      expect(result.results[0].forecastStatus).toBe('AVAILABLE');
      expect(result.results[0].predictedClosingRank).toBe(1250);
      expect(aiServiceClient.predictML).toHaveBeenCalledWith(expect.objectContaining({
        exam: 'KCET',
        college_code: 'c-1',
        course_code: 'CSE',
        category: 'GM',
      }));
    });

    it('returns FORECAST_NOT_AVAILABLE and does not call ML service for unsupported exams', async () => {
      const colleges = [makeCollege({ id: 'c-1', nirfRank: 50, courses: [makeCourse({ courseId: 'MBBS', name: 'Bachelor of Medicine', degreeType: 'MBBS', examsAccepted: ['JEE'] })] })];
      collegeRepo.findByExamAndDiscipline.mockResolvedValue(colleges);
      cutoffService.getTrend.mockResolvedValue(trendFor([1000, 1200, 1100, 1300])); // 4 data points

      const result = await engine.predictColleges({
        ...baseDto,
        examCode: 'JEE' as any,
        category: 'OPEN',
        courseSelections: ['MBBS'],
      });
      expect(result.results[0].forecastStatus).toBe('FORECAST_NOT_AVAILABLE');
      expect(result.results[0].predictedClosingRank).toBeNull();
      expect(aiServiceClient.predictML).not.toHaveBeenCalled();
    });
  });
});
