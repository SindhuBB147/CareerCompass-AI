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
  let engine: PredictionEngineService;

  const baseDto: PredictCollegesDto = {
    examCode: 'KCET', rank: 1000, category: 'GM', discipline: 'Engineering',
    courseSelections: ['Computer Science & Engineering (CSE)'],
    sortBy: 'nirf', page: 1, limit: 20,
  };

  beforeEach(() => {
    collegeRepo = { findByExamAndDiscipline: jest.fn(), findByIds: jest.fn() };
    cutoffService = { getTrend: jest.fn(), findVerifiedCutoffs: jest.fn(), countVerifiedCutoffs: jest.fn().mockResolvedValue(100) };
    scholarshipService = { countMatchingForProfile: jest.fn().mockResolvedValue(2) };
    engine = new PredictionEngineService(collegeRepo, cutoffService, scholarshipService);
  });

  function trendFor(closingRanks: number[], startYear = 2023) {
    return closingRanks.map((closingRank, i) => ({ year: startYear + i, closingRank }));
  }

  describe('validation', () => {
    it('returns an explicit limitation when the exam has no verified cutoffs', async () => {
      cutoffService.countVerifiedCutoffs.mockResolvedValue(0);
      await expect(engine.predictColleges(baseDto)).rejects.toThrow(/No verified KCET cutoff records are available/);
      expect(collegeRepo.findByExamAndDiscipline).not.toHaveBeenCalled();
    });

    it('throws when KCET category is missing', async () => {
      collegeRepo.findByExamAndDiscipline.mockResolvedValue([]);
      const dto = { ...baseDto, category: undefined };
      await expect(engine.predictColleges(dto)).rejects.toThrow(DomainException);
    });

    it('throws when category is invalid for the exam', async () => {
      const dto = { ...baseDto, category: 'OBC' };
      await expect(engine.predictColleges(dto)).rejects.toThrow(/not a valid category for KCET/);
    });

    it('accepts the displayed Cat-1 label and queries the KEA 1G cutoff code', async () => {
      collegeRepo.findByExamAndDiscipline.mockResolvedValue([makeCollege()]);
      cutoffService.getTrend.mockResolvedValue(trendFor([30000, 28000]));
      await engine.predictColleges({ ...baseDto, category: 'Cat-1' });
      expect(cutoffService.getTrend).toHaveBeenCalledWith('col-1', 'CSE', 'KCET', '1G');
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
      const dto = { ...baseDto, examCode: 'COMEDK' as const, discipline: undefined, category: 'GM', courseSelections: [] };
      await expect(engine.predictColleges(dto)).rejects.toThrow(/Select at least one preferred course/);
    });

    it('allows JEE exam with valid category and course selections', async () => {
      collegeRepo.findByExamAndDiscipline.mockResolvedValue([]);
      const dto = {
        examCode: 'JEE' as const,
        rank: 5000,
        category: 'GM',
        courseSelections: ['Computer Science & Engineering (CSE)'],
        sortBy: 'nirf' as const,
        page: 1,
        limit: 20,
      };
      const result = await engine.predictColleges(dto);
      expect(result.results).toEqual([]);
    });

    it('throws when category is invalid for JEE', async () => {
      const dto = {
        examCode: 'JEE' as const,
        rank: 5000,
        category: 'Cat-1', // Cat-1 is KCET only
        courseSelections: ['Computer Science & Engineering (CSE)'],
        sortBy: 'nirf' as const,
        page: 1,
        limit: 20,
      };
      await expect(engine.predictColleges(dto)).rejects.toThrow(/not a valid category for JEE/);
    });
  });

  describe('COMEDK verified-source path', () => {
    const comedkDto: PredictCollegesDto = {
      examCode: 'COMEDK', rank: 1000, category: 'GM', cutoffYear: 2024, cutoffRound: 3,
      courseSelections: ['Computer Science & IT'], sortBy: 'nirf', page: 1, limit: 20,
    };

    beforeEach(() => {
      collegeRepo.findByIds.mockResolvedValue([makeCollege()]);
      cutoffService.findVerifiedCutoffs.mockResolvedValue([{
        collegeId: 'col-1', courseId: 'CS', courseName: 'Computer Science & Engineering', category: 'GM',
        year: 2024, round: 3, closingRank: 1200, source: 'official',
        metadata: { sourceUrl: 'https://www.comedk.org/example.pdf', comedkCollegeCode: 'E027', comedkBranchCode: 'CS' },
      }]);
    });

    it('uses verified COMEDK cutoffs and keeps the official source evidence', async () => {
      const result = await engine.predictColleges(comedkDto);
      expect(cutoffService.findVerifiedCutoffs).toHaveBeenCalledWith('COMEDK', { category: 'GM', year: 2024, round: 3 });
      expect(collegeRepo.findByIds).toHaveBeenCalledWith(['col-1']);
      expect(collegeRepo.findByExamAndDiscipline).not.toHaveBeenCalled();
      expect(cutoffService.getTrend).not.toHaveBeenCalled();
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({ courseId: 'CS', probabilityPercent: null, previousYearCutoff: 1200 });
      expect(result.results[0].historicalCutoffs[0]).toMatchObject({
        year: 2024, round: 3, category: 'GM', closingRank: 1200,
        sourceUrl: 'https://www.comedk.org/example.pdf', sourceCollegeCode: 'E027', sourceBranchCode: 'CS',
      });
    });

    it('returns one college card after selected course matching and retains only the chosen branch evidence', async () => {
      cutoffService.findVerifiedCutoffs.mockResolvedValue([
        { collegeId: 'col-1', courseId: 'CS', courseName: 'Computer Science & Engineering', category: 'GM', year: 2024, round: 3, closingRank: 1200, metadata: { comedkBranchCode: 'CS' } },
        { collegeId: 'col-1', courseId: 'IS', courseName: 'Information Science & Engineering', category: 'GM', year: 2024, round: 3, closingRank: 5000, metadata: { comedkBranchCode: 'IS' } },
      ]);
      const result = await engine.predictColleges({ ...comedkDto, rank: 1000, courseSelections: ['Computer Science & IT'] });
      expect(result.totalResults).toBe(1);
      expect(result.results[0].collegeId).toBe('col-1');
      expect(result.results[0].courseId).toBe('IS');
      expect(result.results[0].historicalCutoffs).toHaveLength(1);
      expect(result.results[0].historicalCutoffs[0].sourceBranchCode).toBe('IS');
      expect(result.results[0].branches).toHaveLength(2);
      expect(result.results[0].branches?.find((branch) => branch.courseId === 'CS')?.previousYearCutoff).toBe(1200);
      expect(result.results[0].branches?.find((branch) => branch.courseId === 'IS')?.previousYearCutoff).toBe(5000);
      expect(result.results[0].branches?.every((branch) => branch.probabilityPercent === null)).toBe(true);
    });

    it('matches Bagalkot location alias while preserving course, seat type, year and round filters', async () => {
      collegeRepo.findByIds.mockResolvedValue([makeCollege({ city: 'Bagalkote', district: 'Bagalkote' })]);
      cutoffService.findVerifiedCutoffs.mockResolvedValue([{
        collegeId: 'col-1', courseId: 'CS', courseName: 'Computer Science & Engineering', category: 'KKR', year: 2024, round: 2,
        closingRank: 5000, metadata: { sourcePhase: 1, comedkBranchCode: 'CS' },
      }]);
      const result = await engine.predictColleges({ ...comedkDto, category: 'KKR', cutoffRound: 2, filters: { city: 'Bagalkot', course: 'Computer Science' } });
      expect(result.totalResults).toBe(1);
      expect(result.results[0].city).toBe('Bagalkote');
      expect(cutoffService.findVerifiedCutoffs).toHaveBeenCalledWith('COMEDK', { category: 'KKR', year: 2024, round: 2 });
    });

    it('combines search, course, type, location, hostel and advanced filters without widening matches', async () => {
      collegeRepo.findByIds.mockResolvedValue([makeCollege({
        name: 'Bagalkote Computer College', city: 'Bagalkote', district: 'Bagalkote', collegeType: 'Autonomous',
        nirfRank: 5, placementSummary: [{ year: 2024, averagePackage: 12 }], feeBreakdown: { totalAnnualFee: 200000 },
      })]);
      cutoffService.findVerifiedCutoffs.mockResolvedValue([{
        collegeId: 'col-1', courseId: 'CS', courseName: 'Computer Science & Engineering', category: 'GM', year: 2024, round: 3,
        closingRank: 5000, metadata: { comedkBranchCode: 'CS' },
      }]);
      const result = await engine.predictColleges({ ...comedkDto, rank: 2500, filters: {
        search: 'Bagalkote Computer', course: 'Computer Science & IT', collegeType: 'Autonomous',
        city: 'Bagalkot', district: 'Bagalkote', hostelRequired: true, maxFee: 250000, maxNirfRank: 10, minPlacementAverage: 10,
      } });
      expect(result.totalResults).toBe(1);
      expect(result.results[0].collegeId).toBe('col-1');
    });

    it('compares weaker ranks to the historical closing rank without hiding the evidence', async () => {
      const result = await engine.predictColleges({ ...comedkDto, rank: 9000 });
      expect(result.results[0].probabilityLevel).toBe('Beyond the 2024 historical closing rank');
      expect(result.results[0].probabilityPercent).toBeNull();
    });

    it('returns insufficient data for a COMEDK seat type that has no imported records', async () => {
      cutoffService.findVerifiedCutoffs.mockResolvedValue([]);
      await expect(engine.predictColleges({ ...comedkDto, category: 'KKR' })).rejects.toThrow(/No verified COMEDK cutoff evidence/);
      expect(collegeRepo.findByExamAndDiscipline).not.toHaveBeenCalled();
    });

    it('preserves location filters on COMEDK source rows', async () => {
      const result = await engine.predictColleges({ ...comedkDto, filters: { city: 'BENGALURU' } });
      expect(result.totalResults).toBe(1);
      const empty = await engine.predictColleges({ ...comedkDto, filters: { city: 'Mysuru' } });
      expect(empty.totalResults).toBe(0);
      expect(empty.insights[0]).toMatch(/No verified COMEDK records match/);

      collegeRepo.findByIds.mockResolvedValue([makeCollege({ city: 'Mangalore' })]);
      const cityAlias = await engine.predictColleges({ ...comedkDto, filters: { city: 'Mangaluru' } });
      expect(cityAlias.totalResults).toBe(1);
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

    it('uses college name as the deterministic tie-break when probabilities are unavailable', async () => {
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
      expect(result.results[0].collegeName).toBe('College A (far rank)');
    });

    it('rejects probability sorting while the API returns no probabilities', async () => {
      const dto = { ...baseDto, sortBy: 'probability' } as any;
      await expect(engine.predictColleges(dto)).rejects.toThrow();
    });
  });

  describe('historical evidence display', () => {
    it('uses supported horizontal reservation cutoff evidence without adding a probability bonus', async () => {
      const college = makeCollege({ id: 'c-1', nirfRank: 50 });
      collegeRepo.findByExamAndDiscipline.mockResolvedValue([college]);
      cutoffService.getTrend.mockResolvedValue(trendFor([2000, 2000]));

      const withoutBonus = await engine.predictColleges(baseDto);
      const withBonus = await engine.predictColleges({
        ...baseDto,
        horizontalReservations: ['Rural Quota'],
      });

      expect(withoutBonus.results[0].probabilityPercent).toBeNull();
      expect(withBonus.results[0].probabilityPercent).toBeNull();
      expect(withBonus.results[0].rationale.horizontalReservationBonus).toBe(0);
      expect(cutoffService.getTrend).toHaveBeenLastCalledWith('c-1', 'CSE', 'KCET', 'GMR');
    });

    it('does not apply a bonus when there is no cutoff data (trendingClosingRank = 0)', async () => {
      const college = makeCollege({ id: 'c-1', nirfRank: 50 });
      collegeRepo.findByExamAndDiscipline.mockResolvedValue([college]);
      cutoffService.getTrend.mockResolvedValue([]);

      const result = await engine.predictColleges({ ...baseDto, horizontalReservations: ['Rural Quota'] });
      expect(result.results[0].rationale.horizontalReservationBonus).toBe(0);
      expect(result.results[0].probabilityLevel).toBe('Insufficient cutoff data');
    });

    it('labels single-year history insufficient while retaining the observed cutoff evidence', async () => {
      const college = makeCollege({ id: 'c-1', nirfRank: 50 });
      collegeRepo.findByExamAndDiscipline.mockResolvedValue([college]);
      cutoffService.getTrend.mockResolvedValue([
        { year: 2023, round: 1, category: 'GM', closingRank: 42000, source: 'official' },
        { year: 2023, round: 2, category: 'GM', closingRank: 38000, source: 'official' },
      ]);

      const result = await engine.predictColleges({ ...baseDto, rank: 33000 });
      expect(result.results[0].dataStatus).toBe('insufficient');
      expect(result.results[0].probabilityLevel).toBe('Insufficient multi-year cutoff data');
      expect(result.results[0].probabilityPercent).toBeNull();
      expect(result.results[0].historicalCutoffs[0]).toMatchObject({ year: 2023, round: 1, source: 'official' });
    });

    it.each([
      ['Rural Quota', 'GMR'],
      ['Kannada Medium', 'GMK'],
    ])('uses the official KEA cutoff category for %s', async (reservation, category) => {
      collegeRepo.findByExamAndDiscipline.mockResolvedValue([makeCollege()]);
      cutoffService.getTrend.mockResolvedValue(trendFor([2000, 2200]));
      await engine.predictColleges({ ...baseDto, horizontalReservations: [reservation] });
      expect(cutoffService.getTrend).toHaveBeenCalledWith('col-1', 'CSE', 'KCET', category);
    });

    it('rejects horizontal reservation filters that have no matching imported category', async () => {
      await expect(engine.predictColleges({ ...baseDto, horizontalReservations: ['PwD'] }))
        .rejects.toThrow(/unsupported: PwD/);
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

      await expect(engine.predictColleges({ ...baseDto, filters: { minProbabilityPercent: 50 } }))
        .rejects.toThrow(/Probability filtering is unavailable/);
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
});
