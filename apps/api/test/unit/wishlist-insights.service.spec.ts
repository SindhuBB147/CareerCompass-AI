import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { WishlistInsightsService } from '../../src/modules/wishlist/services/wishlist-insights.service';
import { WishlistEnrichmentService, CollegeEnrichment } from '../../src/modules/wishlist/services/wishlist-enrichment.service';
import { SavedCollegeRepository } from '../../src/modules/wishlist/repositories/saved-college.repository';
import { SavedCollege, SavedCollegeDocument, SavedCollegeSchema } from '../../src/modules/wishlist/models/saved-college.model';
import { College, CollegeDocument, CollegeSchema } from '../../src/modules/colleges/models/college.model';
import { AuditLog, AuditLogDocument, AuditLogSchema } from '../../src/modules/colleges/models/audit-log.model';
import { CollegeRepository } from '../../src/modules/colleges/repositories/college.repository';

jest.setTimeout(60_000);

describe('WishlistInsightsService', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let savedCollegeModel: Model<SavedCollegeDocument>;
  let collegeModel: Model<CollegeDocument>;
  let auditModel: Model<AuditLogDocument>;
  let service: WishlistInsightsService;
  let highPlacementId: string;
  let bestRoiId: string;
  let safeId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = (await mongoose.connect(mongod.getUri())).connection;
    savedCollegeModel = connection.model(SavedCollege.name, SavedCollegeSchema) as unknown as Model<SavedCollegeDocument>;
    collegeModel = connection.model(College.name, CollegeSchema) as unknown as Model<CollegeDocument>;
    auditModel = connection.model(AuditLog.name, AuditLogSchema) as unknown as Model<AuditLogDocument>;
    const collegeRepo = new CollegeRepository(collegeModel, auditModel);
    const savedCollegeRepo = new SavedCollegeRepository(savedCollegeModel);

    await savedCollegeModel.deleteMany({});
    await collegeModel.deleteMany({});
    const [a, b, c] = await collegeModel.create([
      { name: 'High Placement College', slug: 'high-placement', state: 'Karnataka', city: 'Bengaluru', placementSummary: [{ year: 2025, highestPackage: 50, averagePackage: 12, medianPackage: 10, placementPercentage: 98, topRecruiters: [] }] },
      { name: 'Best ROI College', slug: 'best-roi', state: 'Karnataka', city: 'Bengaluru', placementSummary: [{ year: 2025, highestPackage: 20, averagePackage: 8, medianPackage: 7, placementPercentage: 60, topRecruiters: [] }] },
      { name: 'Safe Bet College', slug: 'safe-bet', state: 'Karnataka', city: 'Bengaluru', placementSummary: [{ year: 2025, highestPackage: 15, averagePackage: 6, medianPackage: 5, placementPercentage: 50, topRecruiters: [] }] },
    ]);
    highPlacementId = a.id; bestRoiId = b.id; safeId = c.id;
    await savedCollegeModel.create([
      { userId: 'u1', collegeId: highPlacementId }, { userId: 'u1', collegeId: bestRoiId }, { userId: 'u1', collegeId: safeId },
    ]);

    const enrichmentByCollege: Record<string, CollegeEnrichment> = {
      [highPlacementId]: { admissionProbability: 60, admissionProbabilityBand: 'Moderate', roiPercent: 80, paybackYears: 5, placementPercentage: 98, aiRecommendationScore: 70, scholarshipEligible: false, scholarshipCount: 0, budgetFit: null },
      [bestRoiId]: { admissionProbability: 55, admissionProbabilityBand: 'Moderate', roiPercent: 220, paybackYears: 2, placementPercentage: 60, aiRecommendationScore: 85, scholarshipEligible: true, scholarshipCount: 1, budgetFit: true },
      [safeId]: { admissionProbability: 92, admissionProbabilityBand: 'Safe', roiPercent: 90, paybackYears: 4, placementPercentage: 50, aiRecommendationScore: 65, scholarshipEligible: true, scholarshipCount: 2, budgetFit: true },
    };
    const enrichmentStub = {
      enrichMany: jest.fn(async (_userId: string, colleges: CollegeDocument[]) => {
        const map = new Map<string, CollegeEnrichment>();
        for (const col of colleges) map.set(col.id, enrichmentByCollege[col.id]);
        return map;
      }),
    } as unknown as WishlistEnrichmentService;

    service = new WishlistInsightsService(savedCollegeRepo, collegeRepo, enrichmentStub);
  });

  afterAll(async () => {
    if (connection) await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it('returns an empty insight set for a user with nothing saved', async () => {
    const { insights, scores } = await service.getInsights('nobody');
    expect(insights).toEqual([]);
    expect(scores).toEqual([]);
  });

  it('identifies the highest-placement college', async () => {
    const { insights } = await service.getInsights('u1');
    const placementInsight = insights.find(i => i.icon === '📈');
    expect(placementInsight?.text).toContain('High Placement College');
    expect(placementInsight?.text).toContain('98%');
  });

  it('identifies the best-ROI college', async () => {
    const { insights } = await service.getInsights('u1');
    const roiInsight = insights.find(i => i.icon === '💰');
    expect(roiInsight?.text).toContain('Best ROI College');
  });

  it('identifies the safer alternative to the current top AI-scored pick', async () => {
    const { insights } = await service.getInsights('u1');
    const safetyInsight = insights.find(i => i.icon === '🛡');
    // top AI score is Best ROI College (85); Safe Bet College has band 'Safe'
    expect(safetyInsight?.text).toContain('Safe Bet College');
    expect(safetyInsight?.text).toContain('Best ROI College');
  });

  it('reports scholarship-eligible colleges', async () => {
    const { insights } = await service.getInsights('u1');
    const scholarshipInsight = insights.find(i => i.icon === '🎓');
    expect(scholarshipInsight?.text).toContain('2 of your saved colleges');
  });

  it('returns a score row per saved college', async () => {
    const { scores } = await service.getInsights('u1');
    expect(scores).toHaveLength(3);
    expect(scores.find(s => s.collegeName === 'Best ROI College')?.aiRecommendationScore).toBe(85);
  });
});
