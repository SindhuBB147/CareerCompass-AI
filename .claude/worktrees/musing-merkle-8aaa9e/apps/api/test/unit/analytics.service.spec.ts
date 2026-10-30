import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { AnalyticsService } from '../../src/modules/analytics/services/analytics.service';
import { CollegeRepository } from '../../src/modules/colleges/repositories/college.repository';
import { User, UserDocument, UserSchema } from '../../src/modules/users/models/user.model';
import { AiConversation, AiConversationDocument, AiConversationSchema } from '../../src/modules/counsellor/models/ai-conversation.model';
import { AiUsageLog, AiUsageLogDocument, AiUsageLogSchema } from '../../src/modules/counsellor/models/ai-usage-log.model';
import { Prediction, PredictionDocument, PredictionSchema } from '../../src/modules/predictions/models/prediction.model';
import { College, CollegeDocument, CollegeSchema } from '../../src/modules/colleges/models/college.model';
import { CutoffConflict, CutoffConflictDocument, CutoffConflictSchema } from '../../src/modules/cutoffs/models/cutoff.model';
import { Scholarship, ScholarshipDocument, ScholarshipSchema } from '../../src/modules/scholarships/models/scholarship.model';
import { AuditLog, AuditLogSchema } from '../../src/modules/colleges/models/audit-log.model';
import { SearchHistory, SearchHistoryDocument, SearchHistorySchema } from '../../src/modules/search/models/search-history.model';
import { UserAiMemory, UserAiMemoryDocument, UserAiMemorySchema } from '../../src/modules/counsellor/models/user-ai-memory.model';

jest.setTimeout(60_000);

describe('AnalyticsService — dashboard metrics (real aggregations)', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let service: AnalyticsService;
  let collegeModel: Model<CollegeDocument>;
  let predModel: Model<PredictionDocument>;
  let conflictModel: Model<CutoffConflictDocument>;
  let convModel: Model<AiConversationDocument>;
  let userModel: Model<UserDocument>;
  let searchHistoryModel: Model<SearchHistoryDocument>;
  let aiMemoryModel: Model<UserAiMemoryDocument>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = (await mongoose.connect(mongod.getUri())).connection;

    userModel = connection.model(User.name, UserSchema) as unknown as Model<UserDocument>;
    convModel = connection.model(AiConversation.name, AiConversationSchema) as unknown as Model<AiConversationDocument>;
    const usageLogModel = connection.model(AiUsageLog.name, AiUsageLogSchema) as unknown as Model<AiUsageLogDocument>;
    predModel = connection.model(Prediction.name, PredictionSchema) as unknown as Model<PredictionDocument>;
    collegeModel = connection.model(College.name, CollegeSchema) as unknown as Model<CollegeDocument>;
    conflictModel = connection.model(CutoffConflict.name, CutoffConflictSchema) as unknown as Model<CutoffConflictDocument>;
    const scholarshipModel = connection.model(Scholarship.name, ScholarshipSchema) as unknown as Model<ScholarshipDocument>;
    searchHistoryModel = connection.model(SearchHistory.name, SearchHistorySchema) as unknown as Model<SearchHistoryDocument>;
    aiMemoryModel = connection.model(UserAiMemory.name, UserAiMemorySchema) as unknown as Model<UserAiMemoryDocument>;
    const auditModel = connection.model(AuditLog.name, AuditLogSchema);

    const collegeRepo = new CollegeRepository(collegeModel, auditModel as any);
    service = new AnalyticsService(
      userModel, convModel, usageLogModel, predModel, collegeModel, conflictModel, scholarshipModel,
      searchHistoryModel, aiMemoryModel, collegeRepo,
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      collegeModel.deleteMany({}), predModel.deleteMany({}), conflictModel.deleteMany({}), convModel.deleteMany({}),
      userModel.deleteMany({}), searchHistoryModel.deleteMany({}), aiMemoryModel.deleteMany({}),
    ]);
    await collegeModel.create([
      {
        name: 'RVCE', slug: 'rvce', state: 'Karnataka', city: 'Bengaluru',
        courses: [
          { courseId: 'CSE', name: 'CS', degreeType: 'B.E.', durationYears: 4, intake: 60, examsAccepted: ['KCET', 'COMEDK'] },
          { courseId: 'ECE', name: 'ECE', degreeType: 'B.E.', durationYears: 4, intake: 60, examsAccepted: ['KCET'] },
        ],
      },
      {
        name: 'BMCRI', slug: 'bmcri', state: 'Karnataka', city: 'Bengaluru',
        courses: [{ courseId: 'MBBS', name: 'MBBS', degreeType: 'MBBS', durationYears: 5, intake: 100, examsAccepted: ['NEET'] }],
      },
    ]);
  });

  it('counts total colleges and total courses across all colleges', async () => {
    const metrics = await service.getDashboardMetrics();
    expect(metrics.totalColleges).toBe(2);
    expect(metrics.totalCourses).toBe(3);
  });

  it('counts distinct colleges offering each exam', async () => {
    const metrics = await service.getDashboardMetrics();
    expect(metrics.kcetColleges).toBe(1);
    expect(metrics.comedkColleges).toBe(1);
    expect(metrics.neetColleges).toBe(1);
  });

  it('counts only open cutoff conflicts as pending', async () => {
    await conflictModel.create([
      { collegeId: 'c1', courseId: 'CSE', examCode: 'KCET', category: 'GM', year: 2024, round: 1, field: 'closingRank', existingValue: 100, incomingValue: 110, status: 'open' },
      { collegeId: 'c1', courseId: 'CSE', examCode: 'KCET', category: 'GM', year: 2024, round: 2, field: 'closingRank', existingValue: 100, incomingValue: 110, status: 'resolved' },
    ]);
    const metrics = await service.getDashboardMetrics();
    expect(metrics.pendingCutoffConflicts).toBe(1);
  });

  it('counts flagged AI conversations regardless of date range', async () => {
    await convModel.create([
      { userId: 'u1', sessionId: 's1', messages: [], startedAt: new Date(), lastMessageAt: new Date(), flaggedForReview: true, status: 'active' },
      { userId: 'u2', sessionId: 's2', messages: [], startedAt: new Date(), lastMessageAt: new Date(), flaggedForReview: false, status: 'active' },
    ]);
    const metrics = await service.getDashboardMetrics();
    expect(metrics.flaggedAiConversations).toBe(1);
  });

  it('resolves popular-college prediction counts to real college names', async () => {
    const rvce = await collegeModel.findOne({ slug: 'rvce' }).exec();
    await predModel.create([
      { userId: 'u1', collegeId: rvce!.id, courseId: 'CSE', examCode: 'KCET', probabilityBand: 'Safe', probabilityPercent: 90, rationale: { trendingClosingRank: 100, studentRank: 50, confidenceLevel: 'high' }, computedAt: new Date() },
      { userId: 'u2', collegeId: rvce!.id, courseId: 'CSE', examCode: 'KCET', probabilityBand: 'Safe', probabilityPercent: 90, rationale: { trendingClosingRank: 100, studentRank: 50, confidenceLevel: 'high' }, computedAt: new Date() },
    ]);
    const metrics = await service.getDashboardMetrics();
    expect(metrics.popularColleges[0]).toEqual({ collegeId: rvce!.id, name: 'RVCE', count: 2 });
    expect(metrics.popularCourses[0]).toEqual({ courseId: 'CSE', count: 2 });
  });

  describe('getMemoryAnalytics — anonymized only, no userId/content in the response', () => {
    it('aggregates popular searches by masked query, most-frequent first', async () => {
      await searchHistoryModel.create([
        { userId: 'u1', queryMasked: 'best cse colleges', intent: 'search_colleges' },
        { userId: 'u2', queryMasked: 'best cse colleges', intent: 'search_colleges' },
        { userId: 'u1', queryMasked: 'kcet cutoff', intent: 'admissions' },
      ]);
      const { popularSearches } = await service.getMemoryAnalytics();
      expect(popularSearches[0]).toEqual({ query: 'best cse colleges', count: 2 });
      expect(popularSearches.every(s => !('userId' in s))).toBe(true);
    });

    it('aggregates common career goals from user profiles, excluding blank ones', async () => {
      await userModel.create([
        { fullName: 'A', authProvider: 'otp', aiPersonalization: { careerGoal: 'Software Engineer' } },
        { fullName: 'B', authProvider: 'otp', aiPersonalization: { careerGoal: 'Software Engineer' } },
        { fullName: 'C', authProvider: 'otp', aiPersonalization: { careerGoal: '' } },
        { fullName: 'D', authProvider: 'otp' },
      ]);
      const { commonCareerGoals } = await service.getMemoryAnalytics();
      expect(commonCareerGoals).toEqual([{ careerGoal: 'Software Engineer', count: 2 }]);
    });

    it('summarizes AI usage stats from the existing usage log, without per-user breakdown', async () => {
      const { aiUsageStats } = await service.getMemoryAnalytics();
      expect(aiUsageStats).toEqual({ totalRequests: 0, avgConfidence: null, lowConfidenceRate: 0 });
    });

    it('counts memory/personalization toggle adoption across active users only', async () => {
      await userModel.create([
        { fullName: 'A', authProvider: 'otp', accountStatus: 'active', aiPersonalization: { conversationMemoryEnabled: false } },
        { fullName: 'B', authProvider: 'otp', accountStatus: 'active' },
        { fullName: 'C', authProvider: 'otp', accountStatus: 'suspended', aiPersonalization: { conversationMemoryEnabled: false } },
      ]);
      const { memoryUsageStats } = await service.getMemoryAnalytics();
      expect(memoryUsageStats.totalActiveUsers).toBe(2);
      // Default (unset) counts as enabled — only the explicit `false` for user A opts out.
      expect(memoryUsageStats.conversationMemoryEnabledCount).toBe(1);
    });

    it('counts how many users have accumulated AI memory slots', async () => {
      await aiMemoryModel.create([
        { userId: 'u1', slots: { discipline: 'CSE' } },
        { userId: 'u2', slots: { city: 'Bangalore' } },
      ]);
      const { memoryUsageStats } = await service.getMemoryAnalytics();
      expect(memoryUsageStats.usersWithAiMemorySlots).toBe(2);
    });
  });
});
