import { SearchService } from '../../src/modules/search/services/search.service';
import { CollegeRankingService } from '../../src/modules/search/services/college-ranking.service';

function noEntities(overrides: Record<string, unknown> = {}) {
  return {
    exam: null, discipline: null, college_type: null, city: null, category: null,
    budget_max: null, nirf_max: null, rank: null, use_profile_rank: false,
    hostel_required: false, placement_focus: false, scholarship_focus: false,
    roi_focus: false, action: null, college_names: [], sort_hint: null,
    ...overrides,
  };
}

function makeCollege(id: string) {
  return {
    _id: id, slug: id, name: `College ${id}`, city: 'Bengaluru', state: 'Karnataka', collegeType: 'Government',
    accreditation: { nirfRank: 50, naac: 'A' },
    feeBreakdown: { totalAnnualFee: 100000 },
    hostelInfo: { boysHostel: true, girlsHostel: false },
    courses: [{ courseId: 'CSE', name: 'CSE', discipline: 'Engineering', examsAccepted: ['KCET'] }],
    placementSummary: [{ year: 2024, averagePackage: 700000, highestPackage: 1500000, placementPercentage: 85 }],
  } as any;
}

describe('SearchService', () => {
  let aiClient: { searchAnalyze: jest.Mock; query: jest.Mock };
  let userRepo: { findById: jest.Mock };
  let aggregator: { findCandidateColleges: jest.Mock; findScholarships: jest.Mock; findCompareTargets: jest.Mock; getPopularColleges: jest.Mock; getPopularCourses: jest.Mock };
  let historyService: { log: jest.Mock; popular: jest.Mock };
  let predictionService: { getPrediction: jest.Mock };
  let financialDashboardService: { getDashboard: jest.Mock };
  let service: SearchService;

  beforeEach(() => {
    aiClient = {
      searchAnalyze: jest.fn().mockResolvedValue({ intent: 'search_colleges', confidence: 0.5, entities: noEntities(), expanded_query: 'cse' }),
      query: jest.fn(),
    };
    userRepo = { findById: jest.fn().mockResolvedValue(null) };
    aggregator = {
      findCandidateColleges: jest.fn().mockResolvedValue([makeCollege('a'), makeCollege('b')]),
      findScholarships: jest.fn().mockResolvedValue([]),
      findCompareTargets: jest.fn().mockResolvedValue([]),
      getPopularColleges: jest.fn().mockResolvedValue([]),
      getPopularCourses: jest.fn().mockResolvedValue([]),
    };
    historyService = { log: jest.fn().mockResolvedValue({ _id: 'hist-1' }), popular: jest.fn().mockResolvedValue([]) };
    predictionService = { getPrediction: jest.fn() };
    financialDashboardService = { getDashboard: jest.fn() };

    service = new SearchService(
      aiClient as any, userRepo as any, aggregator as any, new CollegeRankingService(),
      historyService as any, predictionService as any, financialDashboardService as any,
    );
  });

  it('returns ranked colleges built from the aggregator candidates', async () => {
    const result = await service.search('user-1', { query: 'cse colleges', page: 1, limit: 10 });
    expect(result.colleges).toHaveLength(2);
    expect(result.intent).toBe('search_colleges');
    expect(result.colleges[0].aiScore).toBeGreaterThanOrEqual(0);
  });

  it('logs the search to history with PII-maskable raw query and result counts', async () => {
    await service.search('user-1', { query: 'cse colleges', page: 1, limit: 10 });
    expect(historyService.log).toHaveBeenCalledWith(
      'user-1', 'cse colleges', 'search_colleges', expect.anything(),
      expect.objectContaining({ colleges: 2, scholarships: 0 }),
    );
  });

  it('does not call PredictionService when the student has no rank on file', async () => {
    await service.search('user-1', { query: 'cse colleges', page: 1, limit: 10 });
    expect(predictionService.getPrediction).not.toHaveBeenCalled();
  });

  it('enriches only the top FINANCIAL_ENRICH_COUNT college with a financial dashboard', async () => {
    financialDashboardService.getDashboard.mockResolvedValue({ feeBreakdown: { totalProgramCost: 400000 }, netFinancialBurden: 300000 });
    await service.search('user-1', { query: 'cse colleges', page: 1, limit: 10 });
    expect(financialDashboardService.getDashboard).toHaveBeenCalledTimes(1);
  });

  it('fetches scholarships only when the analyzed entities indicate scholarship focus', async () => {
    await service.search('user-1', { query: 'cse colleges', page: 1, limit: 10 });
    expect(aggregator.findScholarships).not.toHaveBeenCalled();

    aiClient.searchAnalyze.mockResolvedValue({ intent: 'search_scholarships', confidence: 0.8, entities: noEntities({ scholarship_focus: true }), expanded_query: 'sc scholarship' });
    await service.search('user-1', { query: 'scholarships for sc students', page: 1, limit: 10 });
    expect(aggregator.findScholarships).toHaveBeenCalled();
  });

  it('resolves compare targets only for a compare intent with 2+ college names', async () => {
    aiClient.searchAnalyze.mockResolvedValue({
      intent: 'compare_colleges', confidence: 0.9,
      entities: noEntities({ action: 'compare', college_names: ['RV College of Engineering', 'BMS College of Engineering'] }),
      expanded_query: 'compare',
    });
    await service.search('user-1', { query: 'compare RVCE and BMSCE', page: 1, limit: 10 });
    expect(aggregator.findCompareTargets).toHaveBeenCalledWith(['RV College of Engineering', 'BMS College of Engineering']);
  });

  it('still returns a response when history logging fails', async () => {
    historyService.log.mockRejectedValue(new Error('db down'));
    const result = await service.search('user-1', { query: 'cse colleges', page: 1, limit: 10 });
    expect(result.historyId).toBeNull();
    expect(result.colleges).toHaveLength(2);
  });

  it('summarize() calls the existing /rag/query pipeline with top-ranked colleges as structured context', async () => {
    aiClient.query.mockResolvedValue({
      answer: 'Here are your options', reasoning: 'grounded', sources_cited: [], suggested_questions: [], action_buttons: [],
      confidence_level: 'high', low_confidence: false,
    });
    const result = await service.summarize('user-1', { query: 'cse colleges' });
    expect(aiClient.query).toHaveBeenCalledWith(expect.objectContaining({
      query: 'cse colleges',
      structured_context: expect.arrayContaining([expect.objectContaining({ type: 'college' })]),
    }));
    expect(result.summary).toBe('Here are your options');
  });
});
