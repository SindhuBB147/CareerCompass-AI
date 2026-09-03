import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/models/user.model';
import { AiConversation, AiConversationDocument } from '../../counsellor/models/ai-conversation.model';
import { AiUsageLog, AiUsageLogDocument } from '../../counsellor/models/ai-usage-log.model';
import { Prediction, PredictionDocument } from '../../predictions/models/prediction.model';
import { College, CollegeDocument } from '../../colleges/models/college.model';
import { CutoffConflict, CutoffConflictDocument } from '../../cutoffs/models/cutoff.model';
import { Scholarship, ScholarshipDocument } from '../../scholarships/models/scholarship.model';
import { SearchHistory, SearchHistoryDocument } from '../../search/models/search-history.model';
import { UserAiMemory, UserAiMemoryDocument } from '../../counsellor/models/user-ai-memory.model';
import { CollegeRepository } from '../../colleges/repositories/college.repository';

export interface MemoryAnalytics {
  popularSearches: Array<{ query: string; count: number }>;
  commonCareerGoals: Array<{ careerGoal: string; count: number }>;
  aiUsageStats: { totalRequests: number; avgConfidence: number | null; lowConfidenceRate: number };
  memoryUsageStats: {
    totalActiveUsers: number;
    conversationMemoryEnabledCount: number;
    searchHistoryEnabledCount: number;
    aiPersonalizationEnabledCount: number;
    usersWithAiMemorySlots: number;
  };
}

export interface DashboardMetrics {
  // KPI cards
  totalStudents: number;
  activeStudents30d: number;
  newRegistrations7d: number;
  totalColleges: number;
  totalCourses: number;
  kcetColleges: number;
  comedkColleges: number;
  neetColleges: number;
  totalScholarships: number;
  totalPredictions: number;
  aiCounsellorSessions: number;
  aiCounsellorEngagementRate: number;
  pendingCutoffConflicts: number;
  flaggedAiConversations: number;
  predictionAccuracy: number | null;

  // Charts (only backed by real collections — no fabricated traffic/search-analytics series)
  topExams: Array<{ examCode: string; count: number }>;
  registrationTrend: Array<{ date: string; count: number }>;
  predictionTrend: Array<{ date: string; count: number }>;
  aiUsageTrend: Array<{ date: string; count: number }>;
  popularCourses: Array<{ courseId: string; count: number }>;
  popularColleges: Array<{ collegeId: string; name: string; count: number }>;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AiConversation.name) private readonly convModel: Model<AiConversationDocument>,
    @InjectModel(AiUsageLog.name) private readonly usageLogModel: Model<AiUsageLogDocument>,
    @InjectModel(Prediction.name) private readonly predModel: Model<PredictionDocument>,
    @InjectModel(College.name) private readonly collegeModel: Model<CollegeDocument>,
    @InjectModel(CutoffConflict.name) private readonly conflictModel: Model<CutoffConflictDocument>,
    @InjectModel(Scholarship.name) private readonly scholarshipModel: Model<ScholarshipDocument>,
    @InjectModel(SearchHistory.name) private readonly searchHistoryModel: Model<SearchHistoryDocument>,
    @InjectModel(UserAiMemory.name) private readonly aiMemoryModel: Model<UserAiMemoryDocument>,
    private readonly collegeRepo: CollegeRepository,
  ) {}

  async getDashboardMetrics(from?: Date, to?: Date): Promise<DashboardMetrics> {
    const dateFrom = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ?? new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalStudents, activeStudents30d, newRegistrations7d,
      totalPredictions, aiSessions, flaggedAiConversations,
      totalScholarships, pendingCutoffConflicts,
      collegeCourseCounts, examCollegeCounts,
      topExams, registrationTrend, predictionTrend, aiUsageTrend,
      popularCourses, popularCollegesRaw,
    ] = await Promise.all([
      this.userModel.countDocuments({ accountStatus: 'active' }).exec(),
      this.userModel.countDocuments({ updatedAt: { $gte: dateFrom }, accountStatus: 'active' }).exec(),
      this.userModel.countDocuments({ createdAt: { $gte: sevenDaysAgo } }).exec(),
      this.predModel.countDocuments().exec(),
      this.convModel.countDocuments({ startedAt: { $gte: dateFrom, $lte: dateTo } }).exec(),
      this.convModel.countDocuments({ flaggedForReview: true }).exec(),
      this.scholarshipModel.countDocuments({ isActive: true }).exec(),
      this.conflictModel.countDocuments({ status: 'open' }).exec(),
      this.getCollegeAndCourseCounts(),
      this.getExamCollegeCounts(),
      this.getTopExams(),
      this.getDailyTrend(this.userModel, dateFrom, dateTo, 'createdAt'),
      this.getDailyTrend(this.predModel, dateFrom, dateTo, 'computedAt'),
      this.getDailyTrend(this.usageLogModel, dateFrom, dateTo, 'createdAt'),
      this.getPopularCourses(),
      this.getPopularCollegeIds(),
    ]);

    const engagementRate = totalStudents > 0
      ? Math.round((aiSessions / totalStudents) * 100) / 100
      : 0;

    const popularColleges = await this.resolveCollegeNames(popularCollegesRaw);

    return {
      totalStudents,
      activeStudents30d,
      newRegistrations7d,
      totalColleges: collegeCourseCounts.totalColleges,
      totalCourses: collegeCourseCounts.totalCourses,
      kcetColleges: examCollegeCounts.KCET ?? 0,
      comedkColleges: examCollegeCounts.COMEDK ?? 0,
      neetColleges: examCollegeCounts.NEET ?? 0,
      totalScholarships,
      totalPredictions,
      aiCounsellorSessions: aiSessions,
      aiCounsellorEngagementRate: engagementRate,
      pendingCutoffConflicts,
      flaggedAiConversations,
      predictionAccuracy: null, // Requires actual outcome data — deferred until round results are tracked
      topExams,
      registrationTrend,
      predictionTrend,
      aiUsageTrend,
      popularCourses,
      popularColleges,
    };
  }

  /**
   * Admin Portal — anonymized memory/personalization analytics. Every value
   * here is a count or a label+count aggregate; nothing carries a userId,
   * a raw query, or conversation content, so admins never see a specific
   * student's search history or AI conversations — only platform-wide
   * shape (popular topics, how many people opted into what).
   */
  async getMemoryAnalytics(): Promise<MemoryAnalytics> {
    const [popularSearchesRaw, careerGoalsRaw, usageAgg, totalActiveUsers, toggleCounts, usersWithAiMemorySlots] = await Promise.all([
      this.searchHistoryModel.aggregate([
        { $group: { _id: '$queryMasked', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, query: '$_id', count: 1 } },
      ]).exec(),
      this.userModel.aggregate([
        { $match: { 'aiPersonalization.careerGoal': { $nin: [null, ''] } } },
        { $group: { _id: '$aiPersonalization.careerGoal', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, careerGoal: '$_id', count: 1 } },
      ]).exec(),
      this.usageLogModel.aggregate([
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            avgConfidence: { $avg: '$confidenceScore' },
            lowConfidenceCount: { $sum: { $cond: ['$lowConfidence', 1, 0] } },
          },
        },
      ]).exec(),
      this.userModel.countDocuments({ accountStatus: 'active' }).exec(),
      this.userModel.aggregate([
        { $match: { accountStatus: 'active' } },
        {
          $group: {
            _id: null,
            conversationMemoryEnabledCount: { $sum: { $cond: [{ $ne: ['$aiPersonalization.conversationMemoryEnabled', false] }, 1, 0] } },
            searchHistoryEnabledCount: { $sum: { $cond: [{ $ne: ['$aiPersonalization.searchHistoryEnabled', false] }, 1, 0] } },
            aiPersonalizationEnabledCount: { $sum: { $cond: [{ $ne: ['$aiPersonalization.receiveAiSuggestions', false] }, 1, 0] } },
          },
        },
      ]).exec(),
      this.aiMemoryModel.countDocuments().exec(),
    ]);

    const usage = usageAgg[0];
    const toggles = toggleCounts[0];

    return {
      popularSearches: popularSearchesRaw,
      commonCareerGoals: careerGoalsRaw,
      aiUsageStats: {
        totalRequests: usage?.totalRequests ?? 0,
        avgConfidence: usage?.avgConfidence ?? null,
        lowConfidenceRate: usage?.totalRequests ? usage.lowConfidenceCount / usage.totalRequests : 0,
      },
      memoryUsageStats: {
        totalActiveUsers,
        conversationMemoryEnabledCount: toggles?.conversationMemoryEnabledCount ?? 0,
        searchHistoryEnabledCount: toggles?.searchHistoryEnabledCount ?? 0,
        aiPersonalizationEnabledCount: toggles?.aiPersonalizationEnabledCount ?? 0,
        usersWithAiMemorySlots,
      },
    };
  }

  private async getCollegeAndCourseCounts(): Promise<{ totalColleges: number; totalCourses: number }> {
    const [totalColleges, courseAgg] = await Promise.all([
      this.collegeModel.countDocuments().exec(),
      this.collegeModel.aggregate([
        { $project: { courseCount: { $size: { $ifNull: ['$courses', []] } } } },
        { $group: { _id: null, total: { $sum: '$courseCount' } } },
      ]).exec(),
    ]);
    return { totalColleges, totalCourses: courseAgg[0]?.total ?? 0 };
  }

  private async getExamCollegeCounts(): Promise<Record<string, number>> {
    const result = await this.collegeModel.aggregate([
      { $unwind: '$courses' },
      { $unwind: '$courses.examsAccepted' },
      { $group: { _id: '$courses.examsAccepted', collegeIds: { $addToSet: '$_id' } } },
      { $project: { _id: 0, examCode: '$_id', count: { $size: '$collegeIds' } } },
    ]).exec();
    return Object.fromEntries(result.map((r: { examCode: string; count: number }) => [r.examCode, r.count]));
  }

  private async getTopExams(): Promise<Array<{ examCode: string; count: number }>> {
    return this.userModel.aggregate([
      { $unwind: '$examProfiles' },
      { $group: { _id: '$examProfiles.examCode', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 4 },
      { $project: { _id: 0, examCode: '$_id', count: 1 } },
    ]).exec();
  }

  private async getDailyTrend(
    model: Model<any>,
    from: Date,
    to: Date,
    dateField: string,
  ): Promise<Array<{ date: string; count: number }>> {
    return model.aggregate([
      { $match: { [dateField]: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
    ]).exec();
  }

  private async getPopularCourses(): Promise<Array<{ courseId: string; count: number }>> {
    return this.predModel.aggregate([
      { $group: { _id: '$courseId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { _id: 0, courseId: '$_id', count: 1 } },
    ]).exec();
  }

  private async getPopularCollegeIds(): Promise<Array<{ collegeId: string; count: number }>> {
    return this.predModel.aggregate([
      { $group: { _id: '$collegeId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { _id: 0, collegeId: '$_id', count: 1 } },
    ]).exec();
  }

  private async resolveCollegeNames(
    entries: Array<{ collegeId: string; count: number }>,
  ): Promise<Array<{ collegeId: string; name: string; count: number }>> {
    if (entries.length === 0) return [];
    const colleges = await this.collegeRepo.findByIds(entries.map(e => e.collegeId));
    const nameById = new Map(colleges.map(c => [c.id, c.name]));
    return entries.map(e => ({ collegeId: e.collegeId, name: nameById.get(e.collegeId) ?? 'Unknown College', count: e.count }));
  }
}
