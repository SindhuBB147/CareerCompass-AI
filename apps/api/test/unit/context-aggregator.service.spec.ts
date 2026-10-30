import { ContextAggregatorService } from '../../src/modules/counsellor/services/context-aggregator.service';

describe('ContextAggregatorService', () => {
  let userRepo: any;
  let collegeRepo: any;
  let cutoffService: any;
  let predictionService: any;
  let scholarshipService: any;
  let financialDashboardService: any;
  let roadmapGeneratorService: any;
  let notificationService: any;
  let reportGeneratorService: any;
  let service: ContextAggregatorService;

  const rvce = {
    _id: 'college-1',
    name: 'RVCE',
    city: 'Bengaluru',
    state: 'Karnataka',
    collegeType: 'Autonomous',
    accreditation: { nirfRank: 97, naac: 'A++' },
    courses: [{ courseId: 'RVCE-CSE', name: 'Computer Science Engineering', examsAccepted: ['KCET'], feePerYear: 220000 }],
    placementSummary: [{ year: 2025, placementPercentage: 92, medianPackage: 850000 }],
    feeBreakdown: { totalAnnualFee: 250000 },
  };

  beforeEach(() => {
    userRepo = { findById: jest.fn() };
    collegeRepo = { search: jest.fn().mockResolvedValue({ results: [rvce], totalResults: 1 }) };
    cutoffService = { getTrend: jest.fn().mockResolvedValue([]) };
    predictionService = { getPrediction: jest.fn() };
    scholarshipService = { getMatched: jest.fn().mockResolvedValue([]) };
    financialDashboardService = { getDashboard: jest.fn() };
    roadmapGeneratorService = { getOrGenerate: jest.fn() };
    notificationService = { listForUser: jest.fn().mockResolvedValue({ notifications: [], total: 0 }) };
    reportGeneratorService = { listRecentForUser: jest.fn().mockResolvedValue([]) };

    service = new ContextAggregatorService(
      userRepo, collegeRepo, cutoffService, predictionService, scholarshipService, financialDashboardService,
      roadmapGeneratorService, notificationService, reportGeneratorService,
    );
  });

  it('always attempts a college search and includes matches in structured context', async () => {
    userRepo.findById.mockResolvedValue(null);

    const { structuredContext } = await service.gather('user-1', 'Tell me about RVCE');

    expect(collegeRepo.search).toHaveBeenCalledWith({ q: 'Tell me about RVCE', page: 1, limit: 3 });
    expect(structuredContext.some(i => i.type === 'college' && i.title === 'RVCE')).toBe(true);
  });

  it('gracefully continues when college search throws', async () => {
    userRepo.findById.mockResolvedValue(null);
    collegeRepo.search.mockRejectedValue(new Error('db down'));

    const { structuredContext } = await service.gather('user-1', 'Tell me about RVCE');

    expect(structuredContext).toEqual([]);
  });

  it('fetches matched scholarships when the query is scholarship-related', async () => {
    const user = { examProfiles: [], category: 'SC', domicileState: 'Karnataka', preferences: {} };
    userRepo.findById.mockResolvedValue(user);
    scholarshipService.getMatched.mockResolvedValue([
      { _id: 's1', name: 'SC ST Scholarship', provider: 'government', awardAmount: { type: 'percentage', value: 100 }, applicationDeadline: new Date('2026-10-01') },
    ]);

    const { structuredContext } = await service.gather('user-1', 'Which scholarships am I eligible for?');

    expect(scholarshipService.getMatched).toHaveBeenCalledWith('user-1');
    expect(structuredContext.some(i => i.type === 'scholarship' && i.title === 'SC ST Scholarship')).toBe(true);
  });

  it('does not fetch scholarships for an unrelated query', async () => {
    userRepo.findById.mockResolvedValue({ examProfiles: [], preferences: {} });

    await service.gather('user-1', 'What is the KCET closing rank at RVCE?');

    expect(scholarshipService.getMatched).not.toHaveBeenCalled();
  });

  it('adds a prediction and cutoff trend when the student has a matching exam profile', async () => {
    const user = {
      examProfiles: [{ examCode: 'KCET', rank: 4500, categoryUsed: 'General' }],
      category: 'General', preferences: {},
    };
    userRepo.findById.mockResolvedValue(user);
    predictionService.getPrediction.mockResolvedValue({
      probabilityBand: 'Moderate', probabilityPercent: 55,
      rationale: { trendingClosingRank: 5000, studentRank: 4500, confidenceLevel: 'high' },
    });
    cutoffService.getTrend.mockResolvedValue([{ year: 2025, round: 1, closingRank: 4950 }]);

    const { structuredContext } = await service.gather('user-1', 'What are my chances at RVCE for CSE?');

    expect(predictionService.getPrediction).toHaveBeenCalledWith('user-1', 'college-1', 'RVCE-CSE', 'KCET');
    expect(structuredContext.some(i => i.type === 'prediction')).toBe(true);
    expect(structuredContext.some(i => i.type === 'cutoff')).toBe(true);
  });

  it('skips predictions when the student has no exam profile for an accepted exam', async () => {
    const user = { examProfiles: [{ examCode: 'JEE', rank: 1000 }], preferences: {} };
    userRepo.findById.mockResolvedValue(user);

    const { structuredContext } = await service.gather('user-1', 'What are my chances at RVCE?');

    expect(predictionService.getPrediction).not.toHaveBeenCalled();
    expect(structuredContext.some(i => i.type === 'prediction')).toBe(false);
  });

  it('builds student context from the user profile', async () => {
    const user = {
      examProfiles: [{ examCode: 'KCET', rank: 4500 }],
      category: 'General', domicileState: 'Karnataka',
      preferences: { budgetMax: 300000, preferredCourses: ['CSE'], riskAppetite: 'balanced' },
    };
    userRepo.findById.mockResolvedValue(user);

    const { studentContext } = await service.gather('user-1', 'unrelated free text');

    expect(studentContext).toEqual(
      expect.objectContaining({ rank: 4500, examCode: 'KCET', category: 'General', budgetMax: 300000, riskAppetite: 'balanced' }),
    );
  });

  it('returns an empty student context when the user profile is missing', async () => {
    userRepo.findById.mockResolvedValue(null);
    const { studentContext } = await service.gather('user-1', 'hello');
    expect(studentContext).toEqual({});
  });

  it('pushes financial and roi structured context for a fee-related query, sourced from a single getDashboard call', async () => {
    const user = { examProfiles: [], preferences: { hostelRequired: true } };
    userRepo.findById.mockResolvedValue(user);
    financialDashboardService.getDashboard.mockResolvedValue({
      feeBreakdown: { durationYears: 4, totalProgramCost: 1719000 },
      scholarshipSavings: { totalEstimatedSavings: 960000 },
      netFinancialBurden: 759000,
      loanAmountNeeded: 759000,
      estimatedEmi: 9821,
      roi: { projectedPackageAnnual: 1280000, placementPercentage: 98.4, paybackYears: 0.87, roiPercent: 1572 },
    });

    const { structuredContext } = await service.gather('user-1', 'What will this college cost me and what is the ROI?');

    expect(financialDashboardService.getDashboard).toHaveBeenCalledTimes(1);
    expect(financialDashboardService.getDashboard).toHaveBeenCalledWith('user-1', {
      collegeId: 'college-1', courseId: 'RVCE-CSE', hostelRequired: true,
    });
    expect(structuredContext.some(i => i.type === 'financial' && i.content.includes('1719000'))).toBe(true);
    expect(structuredContext.some(i => i.type === 'roi' && i.content.includes('1572'))).toBe(true);
  });

  it('omits the roi structured context when the dashboard has no projected package (e.g. no placement data)', async () => {
    userRepo.findById.mockResolvedValue({ examProfiles: [], preferences: {} });
    financialDashboardService.getDashboard.mockResolvedValue({
      feeBreakdown: { durationYears: 4, totalProgramCost: 1719000 },
      scholarshipSavings: { totalEstimatedSavings: 0 },
      netFinancialBurden: 1719000,
      loanAmountNeeded: 1719000,
      estimatedEmi: 0,
      roi: { projectedPackageAnnual: 0, placementPercentage: null, paybackYears: 0, roiPercent: 0 },
    });

    const { structuredContext } = await service.gather('user-1', 'What is the total fee here?');

    expect(structuredContext.some(i => i.type === 'financial')).toBe(true);
    expect(structuredContext.some(i => i.type === 'roi')).toBe(false);
  });

  it('does not call getDashboard for a query unrelated to financial topics', async () => {
    userRepo.findById.mockResolvedValue({ examProfiles: [], preferences: {} });
    await service.gather('user-1', 'Tell me about RVCE placements');
    expect(financialDashboardService.getDashboard).not.toHaveBeenCalled();
  });

  it('gracefully continues when getDashboard throws', async () => {
    userRepo.findById.mockResolvedValue({ examProfiles: [], preferences: {} });
    financialDashboardService.getDashboard.mockRejectedValue(new Error('boom'));

    const { structuredContext } = await service.gather('user-1', 'What is the hostel fee?');

    expect(structuredContext.some(i => i.type === 'financial')).toBe(false);
    expect(structuredContext.some(i => i.type === 'roi')).toBe(false);
  });

  it('adds roadmap structured context for a career-related query', async () => {
    userRepo.findById.mockResolvedValue({ examProfiles: [], preferences: {} });
    roadmapGeneratorService.getOrGenerate.mockResolvedValue({
      careerName: 'Software Engineer',
      analytics: { completionPercent: 40 },
      phases: [
        {
          label: 'Year 2 — Core Skills',
          milestones: [
            { title: 'Earn AWS Certified Cloud Practitioner', description: 'Validate your skills early.', category: 'certification', priority: 'high', status: 'not_started' },
            { title: 'Deepen core technical skills', description: 'Master algorithms.', category: 'skill', priority: 'high', status: 'completed' },
          ],
        },
      ],
    });

    const { structuredContext } = await service.gather('user-1', 'What certification should I target for my career roadmap?');

    expect(roadmapGeneratorService.getOrGenerate).toHaveBeenCalledWith('user-1');
    const roadmapContext = structuredContext.find(i => i.type === 'roadmap');
    expect(roadmapContext?.title).toBe('Career roadmap for Software Engineer');
    expect(roadmapContext?.content).toContain('AWS Certified Cloud Practitioner');
  });

  it('gracefully continues when roadmap generation throws', async () => {
    userRepo.findById.mockResolvedValue({ examProfiles: [], preferences: {} });
    roadmapGeneratorService.getOrGenerate.mockRejectedValue(new Error('roadmap down'));

    const { structuredContext } = await service.gather('user-1', 'What skill should I learn next for my career?');

    expect(structuredContext.some(i => i.type === 'roadmap')).toBe(false);
  });

  describe('notifications', () => {
    it('includes unread notifications for an admissions-related query', async () => {
      userRepo.findById.mockResolvedValue({ examProfiles: [], preferences: {} });
      notificationService.listForUser.mockResolvedValue({
        notifications: [{
          _id: 'n1', title: 'KCET Round 2 deadline', message: 'Choice filling closes in 2 days.',
          priority: 'high', category: 'deadline', scheduledFor: new Date('2026-09-01'),
        }],
        total: 1,
      });

      const { structuredContext } = await service.gather('user-1', 'Which colleges can I get?');

      expect(notificationService.listForUser).toHaveBeenCalledWith('user-1', { isRead: false }, 1, 5);
      const item = structuredContext.find(i => i.type === 'notification');
      expect(item?.title).toBe('KCET Round 2 deadline');
      expect(item?.content).toContain('Choice filling closes in 2 days.');
    });

    it('gracefully continues when notification lookup throws', async () => {
      userRepo.findById.mockResolvedValue({ examProfiles: [], preferences: {} });
      notificationService.listForUser.mockRejectedValue(new Error('notifications down'));

      const { structuredContext } = await service.gather('user-1', 'Which colleges can I get?');

      expect(structuredContext.some(i => i.type === 'notification')).toBe(false);
    });
  });

  describe('reports', () => {
    it('always includes recent generated reports regardless of query topic', async () => {
      userRepo.findById.mockResolvedValue({ examProfiles: [], preferences: {} });
      reportGeneratorService.listRecentForUser.mockResolvedValue([
        { _id: 'r1', reportType: 'financial_planning', format: 'pdf', generatedAt: new Date('2026-08-01') },
      ]);

      const { structuredContext } = await service.gather('user-1', 'hello there');

      expect(reportGeneratorService.listRecentForUser).toHaveBeenCalledWith('user-1', 3);
      const item = structuredContext.find(i => i.type === 'report');
      expect(item?.content).toContain('PDF');
    });

    it('gracefully continues when report lookup throws', async () => {
      userRepo.findById.mockResolvedValue({ examProfiles: [], preferences: {} });
      reportGeneratorService.listRecentForUser.mockRejectedValue(new Error('reports down'));

      const { structuredContext } = await service.gather('user-1', 'hello there');

      expect(structuredContext.some(i => i.type === 'report')).toBe(false);
    });
  });

  describe('cross-turn AI memory (rememberedSlots)', () => {
    it('augments the college search query with a remembered course/city the current message omits', async () => {
      userRepo.findById.mockResolvedValue(null);

      await service.gather('user-1', 'recommend colleges', { discipline: 'CSE', city: 'Bangalore' });

      expect(collegeRepo.search).toHaveBeenCalledWith({ q: 'recommend colleges CSE Bangalore', page: 1, limit: 3 });
    });

    it('does not duplicate a remembered term the current message already includes', async () => {
      userRepo.findById.mockResolvedValue(null);

      await service.gather('user-1', 'recommend CSE colleges', { discipline: 'CSE', city: undefined });

      expect(collegeRepo.search).toHaveBeenCalledWith({ q: 'recommend CSE colleges', page: 1, limit: 3 });
    });

    it('adds a "remembered from this conversation" structured context summarizing the slots', async () => {
      userRepo.findById.mockResolvedValue(null);

      const { structuredContext } = await service.gather('user-1', 'recommend colleges', {
        discipline: 'CSE', city: 'Bangalore', budgetMax: 500000,
      });

      const memoryItem = structuredContext.find(i => i.type === 'memory');
      expect(memoryItem).toBeDefined();
      expect(memoryItem?.content).toContain('course: CSE');
      expect(memoryItem?.content).toContain('preferred city: Bangalore');
      expect(memoryItem?.content).toContain('budget: ₹500000');
    });

    it('adds no memory structured context when no slots are remembered', async () => {
      userRepo.findById.mockResolvedValue(null);
      const { structuredContext } = await service.gather('user-1', 'recommend colleges', {});
      expect(structuredContext.some(i => i.type === 'memory')).toBe(false);
    });

    it('is a no-op when rememberedSlots is omitted entirely (backward compatible)', async () => {
      userRepo.findById.mockResolvedValue(null);
      await service.gather('user-1', 'Tell me about RVCE');
      expect(collegeRepo.search).toHaveBeenCalledWith({ q: 'Tell me about RVCE', page: 1, limit: 3 });
    });
  });
});
