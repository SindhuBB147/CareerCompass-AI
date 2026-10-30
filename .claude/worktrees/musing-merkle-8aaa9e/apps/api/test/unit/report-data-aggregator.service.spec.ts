import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { ReportDataAggregatorService } from '../../src/modules/student-reports/services/report-data-aggregator.service';
import { UserRepository } from '../../src/modules/users/repositories/user.repository';
import { CollegeRepository } from '../../src/modules/colleges/repositories/college.repository';
import { User, UserDocument, UserSchema } from '../../src/modules/users/models/user.model';
import { College, CollegeDocument, CollegeSchema } from '../../src/modules/colleges/models/college.model';
import { AuditLog, AuditLogDocument, AuditLogSchema } from '../../src/modules/colleges/models/audit-log.model';
import { Prediction, PredictionDocument, PredictionSchema } from '../../src/modules/predictions/models/prediction.model';

jest.setTimeout(60_000);

// Real Mongo only for the collections ReportDataAggregatorService reads
// directly (Prediction/User/College) — the higher-level services it
// delegates to (PredictionService, FinancialDashboardService,
// ScholarshipService, RoadmapGeneratorService, WishlistService) already
// have their own dedicated test suites elsewhere in this repo, so they're
// stubbed here to keep this spec focused on the aggregator's own
// assembly/derivation logic (in particular the getDashboardSummary
// zero-stub bypass, which is the regression this file exists to guard).
describe('ReportDataAggregatorService', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let userModel: Model<UserDocument>;
  let collegeModel: Model<CollegeDocument>;
  let predictionModel: Model<PredictionDocument>;
  let userRepo: UserRepository;
  let collegeRepo: CollegeRepository;
  let userId: string;
  let collegeId: string;

  const predictionServiceStub: any = {
    getRoi: jest.fn().mockResolvedValue({ netCost: 400000, projectedPackageAnnual: 800000, roiPercent: 120, paybackYears: 2, totalInvestment: 0, tuitionAndFees: 0, livingCost: 0, scholarshipSavings: 0, highestPackageAnnual: 0, placementPercentage: 90, durationYears: 4 }),
    getPlacementEstimate: jest.fn().mockResolvedValue({ placementPercentRange: [80, 95], packageRange: [500000, 1200000] }),
    optimizeChoiceFilling: jest.fn().mockResolvedValue([{ priority: 1, collegeId: '', courseId: 'CSE', band: 'Safe', probabilityPercent: 91 }]),
  };
  const financialDashboardServiceStub: any = {
    getComparison: jest.fn().mockResolvedValue({
      rows: [
        { collegeId: 'c1', collegeName: 'RVCE', courseId: 'CSE', courseName: 'Computer Science', totalFees: 400000, hostelCost: 100000, livingCost: 0, totalCost: 500000, scholarshipSavings: 20000, placementPercentage: 92, avgPackage: 800000, highestPackage: 2000000, roiPercent: 120, paybackYears: 2, loanAmountNeeded: 300000 },
        { collegeId: 'c2', collegeName: 'BMSCE', courseId: 'CSE', courseName: 'Computer Science', totalFees: 350000, hostelCost: 90000, livingCost: 0, totalCost: 440000, scholarshipSavings: 15000, placementPercentage: 88, avgPackage: 700000, highestPackage: 1800000, roiPercent: 110, paybackYears: 2.2, loanAmountNeeded: 250000 },
      ],
    }),
  };
  const scholarshipServiceStub: any = {
    getRecommended: jest.fn().mockResolvedValue([
      {
        scholarship: { id: 's1', name: 'Merit Scholarship', provider: 'government', providerName: 'KEA', awardAmount: { type: 'fixed', value: 25000 }, applicationDeadline: new Date('2026-12-01') },
        eligibility: { verdict: 'eligible', score: 90, checks: [{ key: 'income', label: 'Income', result: 'pass', message: 'Within limit' }], reasons: { passed: ['income'], failed: [], unknown: [] } },
        tier: 'highly_recommended', tierLabel: 'Highly Recommended',
      },
    ]),
    listBookmarks: jest.fn().mockResolvedValue([]),
  };
  const roadmapGeneratorServiceStub: any = {
    getActive: jest.fn().mockResolvedValue({
      analytics: { completionPercent: 45, skillScore: 60, achievements: [{ label: 'First Milestone', earnedAt: new Date() }] },
    }),
  };
  const wishlistServiceStub: any = {
    getWishlist: jest.fn().mockResolvedValue({ lists: [], colleges: [{ collegeId: 'c1' }, { collegeId: 'c2' }, { collegeId: 'c3' }] }),
  };
  const wishlistComparisonServiceStub: any = {
    compare: jest.fn(),
  };

  let aggregator: ReportDataAggregatorService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = (await mongoose.connect(mongod.getUri())).connection;
    userModel = connection.model(User.name, UserSchema) as unknown as Model<UserDocument>;
    collegeModel = connection.model(College.name, CollegeSchema) as unknown as Model<CollegeDocument>;
    const auditModel = connection.model(AuditLog.name, AuditLogSchema) as unknown as Model<AuditLogDocument>;
    predictionModel = connection.model(Prediction.name, PredictionSchema) as unknown as Model<PredictionDocument>;

    userRepo = new UserRepository(userModel);
    collegeRepo = new CollegeRepository(collegeModel, auditModel);

    const user = await userModel.create({
      fullName: 'Asha Rao', email: 'asha@example.com', category: 'General', domicileState: 'Karnataka',
      examProfiles: [{ examCode: 'KCET', year: 2026, rank: 5000 }],
      preferences: { riskAppetite: 'balanced' },
    });
    userId = user.id;

    const college = await collegeModel.create({
      name: 'RVCE', slug: 'rvce', state: 'Karnataka', city: 'Bengaluru',
      accreditation: { nirfRank: 12 },
      courses: [{ courseId: 'CSE', name: 'Computer Science', degreeType: 'B.E.', durationYears: 4, intake: 180 }],
    });
    collegeId = college.id;

    predictionServiceStub.optimizeChoiceFilling.mockResolvedValue([{ priority: 1, collegeId, courseId: 'CSE', band: 'Safe', probabilityPercent: 91 }]);

    await predictionModel.create({
      userId, collegeId, courseId: 'CSE', examCode: 'KCET',
      probabilityBand: 'Safe', probabilityPercent: 91,
      rationale: { trendingClosingRank: 6000, studentRank: 5000, confidenceLevel: 'high' },
      computedAt: new Date(),
    });
    // A second shortlisted college/course — needed so Financial Planning's
    // default (derive collegeCourseIds from the shortlist) has the >= 2
    // entries it requires; also exercises the "college not in collegeModel"
    // fallback-to-raw-id path in the Admission Prediction detail rows.
    await predictionModel.create({
      userId, collegeId: 'c2-synthetic', courseId: 'CSE', examCode: 'KCET',
      probabilityBand: 'Moderate', probabilityPercent: 70,
      rationale: { trendingClosingRank: 8000, studentRank: 5000, confidenceLevel: 'medium' },
      computedAt: new Date(),
    });

    aggregator = new ReportDataAggregatorService(
      predictionModel, userRepo, collegeRepo,
      predictionServiceStub, financialDashboardServiceStub, scholarshipServiceStub,
      roadmapGeneratorServiceStub, wishlistServiceStub, wishlistComparisonServiceStub,
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('builds Admission Prediction data from real prediction records', async () => {
    const data = await aggregator.buildAdmissionPredictionData(userId);
    expect(data.reportType).toBe('admission_prediction');
    expect(data.student.fullName).toBe('Asha Rao');
    const detail = data.sections.find(s => s.key === 'shortlist-detail');
    expect(detail?.kind).toBe('table');
    expect((detail as any).data.rows[0]).toContain('RVCE');
    expect((detail as any).data.rows[0]).toContain('Computer Science');
    expect(data.aiSummary).toContain('RVCE');
  });

  it('throws UNPROCESSABLE when the student has no predictions', async () => {
    const otherUser = await userModel.create({ fullName: 'No Predictions', examProfiles: [] });
    await expect(aggregator.buildAdmissionPredictionData(otherUser.id)).rejects.toThrow();
  });

  it('builds Financial Planning data by deriving collegeCourseIds from the shortlist when none are passed', async () => {
    const data = await aggregator.buildFinancialPlanningData(userId);
    expect(financialDashboardServiceStub.getComparison).toHaveBeenCalled();
    const table = data.sections.find(s => s.key === 'cost-comparison');
    expect((table as any).data.rows).toHaveLength(2);
    expect(data.aiSummary).toContain('RVCE');
  });

  it('builds Scholarship Eligibility data with real eligibility checks', async () => {
    const data = await aggregator.buildScholarshipEligibilityData(userId);
    const table = data.sections.find(s => s.key === 'recommended');
    expect((table as any).data.rows[0]).toContain('Merit Scholarship');
    expect(data.aiSummary).toContain('Merit Scholarship');
  });

  it('builds Student Progress data with real, non-zero counts — never the getDashboardSummary() zero stubs', async () => {
    const data = await aggregator.buildStudentProgressData(userId);
    const overview = data.sections.find(s => s.key === 'progress-overview');
    const values = Object.fromEntries((overview as any).data.map((i: any) => [i.label, i.value]));

    // Regression guard: UserService.getDashboardSummary() hardcodes these
    // to 0 — this report must not propagate that stub.
    expect(values['Saved Colleges']).toBe('3');
    expect(values['Predictions Run']).toBe('2');
    expect(values['Eligible Scholarships']).toBe('1');
    expect(values['Career Roadmap Completion']).toBe('45%');
  });

  it('builds College Comparison data from WishlistComparisonService.compare()', async () => {
    wishlistComparisonServiceStub.compare.mockResolvedValueOnce([
      {
        college: { name: 'RVCE', accreditation: { nirfRank: 12 }, collegeType: 'Government', city: 'Bengaluru', feeBreakdown: { totalAnnualFee: 200000 }, hostelInfo: { boysHostel: true, girlsHostel: true } },
        enrichment: { admissionProbability: 85, admissionProbabilityBand: 'Safe', roiPercent: 120, paybackYears: 2, placementPercentage: 92, aiRecommendationScore: 88, scholarshipEligible: true, scholarshipCount: 2, budgetFit: true },
      },
      {
        college: { name: 'BMSCE', accreditation: { nirfRank: 45 }, collegeType: 'Private', city: 'Bengaluru', feeBreakdown: { totalAnnualFee: 350000 }, hostelInfo: { boysHostel: true, girlsHostel: false } },
        enrichment: { admissionProbability: 60, admissionProbabilityBand: 'Moderate', roiPercent: 90, paybackYears: 3, placementPercentage: 85, aiRecommendationScore: 70, scholarshipEligible: false, scholarshipCount: 0, budgetFit: false },
      },
    ]);

    const data = await aggregator.buildCollegeComparisonData(userId, { collegeIds: ['c1', 'c2'] });
    expect(wishlistComparisonServiceStub.compare).toHaveBeenCalledWith(userId, ['c1', 'c2']);
    expect(data.reportType).toBe('college_comparison');
    const table = data.sections.find(s => s.key === 'comparison-overview');
    expect((table as any).data.rows[0]).toContain('RVCE');
    expect(data.aiSummary).toContain('RVCE');
  });

  it('throws UNPROCESSABLE for College Comparison when fewer than 2 colleges are available', async () => {
    const otherUser = await userModel.create({ fullName: 'No Wishlist', examProfiles: [] });
    wishlistServiceStub.getWishlist.mockResolvedValueOnce({ lists: [], colleges: [] });
    await expect(aggregator.buildCollegeComparisonData(otherUser.id)).rejects.toThrow();
  });

  it('builds Career Roadmap data from the active roadmap document', async () => {
    roadmapGeneratorServiceStub.getActive.mockResolvedValueOnce({
      careerName: 'Software Engineer',
      analytics: { completionPercent: 40, skillScore: 55, completedCount: 2, totalCount: 5, achievements: [{ label: 'First Milestone', earnedAt: new Date() }] },
      phases: [
        { label: 'Foundation', order: 1, milestones: [{ title: 'Learn DSA', category: 'skill', status: 'completed', estimatedWeeks: 4 }, { title: 'Build a Project', category: 'project', status: 'in_progress', estimatedWeeks: 3 }] },
      ],
    });

    const data = await aggregator.buildCareerRoadmapData(userId);
    expect(data.reportType).toBe('career_roadmap');
    const table = data.sections.find(s => s.key === 'milestones');
    expect((table as any).data.rows.some((r: any[]) => r.includes('Learn DSA'))).toBe(true);
    expect(data.aiSummary).toContain('Software Engineer');
  });

  it('throws UNPROCESSABLE for Career Roadmap when no active roadmap exists', async () => {
    const otherUser = await userModel.create({ fullName: 'No Roadmap', examProfiles: [] });
    roadmapGeneratorServiceStub.getActive.mockResolvedValueOnce(null);
    await expect(aggregator.buildCareerRoadmapData(otherUser.id)).rejects.toThrow();
  });

  it('builds AI Recommendation data by combining predictions, scholarships, and the next roadmap milestone', async () => {
    roadmapGeneratorServiceStub.getActive.mockResolvedValueOnce({
      phases: [{ label: 'Foundation', order: 1, milestones: [{ title: 'Learn DSA', category: 'skill', status: 'not_started', estimatedWeeks: 4 }] }],
    });

    const data = await aggregator.buildAiRecommendationData(userId);
    expect(data.reportType).toBe('ai_recommendation');
    const collegeTable = data.sections.find(s => s.key === 'recommended-colleges');
    expect((collegeTable as any).data.rows[0]).toContain('RVCE');
    const scholarshipTable = data.sections.find(s => s.key === 'recommended-scholarships');
    expect((scholarshipTable as any).data.rows[0]).toContain('Merit Scholarship');
    expect(data.aiSummary).toContain('RVCE');
  });

  it('builds Saved Colleges data from the full wishlist view', async () => {
    const savedAt = new Date('2026-01-15');
    wishlistServiceStub.getWishlist.mockResolvedValueOnce({
      lists: [{ id: 'list1', name: 'Favorites' }],
      colleges: [
        { college: { name: 'RVCE' }, listIds: ['list1'], status: 'target', enrichment: { admissionProbability: 85 }, savedAt },
      ],
    });

    const data = await aggregator.buildSavedCollegesData(userId);
    expect(data.reportType).toBe('saved_colleges');
    const table = data.sections.find(s => s.key === 'saved-colleges-table');
    expect((table as any).data.rows[0]).toContain('RVCE');
    expect((table as any).data.rows[0]).toContain('Favorites');
    expect(data.aiSummary).toContain('1 saved college');
  });

  it('throws UNPROCESSABLE for Saved Colleges when the wishlist is empty', async () => {
    const otherUser = await userModel.create({ fullName: 'Empty Wishlist', examProfiles: [] });
    wishlistServiceStub.getWishlist.mockResolvedValueOnce({ lists: [], colleges: [] });
    await expect(aggregator.buildSavedCollegesData(otherUser.id)).rejects.toThrow();
  });
});
