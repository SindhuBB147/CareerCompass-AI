import { MongoMemoryServer } from 'mongodb-memory-server';
import { EventEmitter2 } from '@nestjs/event-emitter';
import mongoose, { Connection, Model } from 'mongoose';
import { WishlistComparisonService } from '../../src/modules/wishlist/services/wishlist-comparison.service';
import { WishlistEnrichmentService, CollegeEnrichment } from '../../src/modules/wishlist/services/wishlist-enrichment.service';
import { ComparisonSnapshotRepository } from '../../src/modules/wishlist/repositories/comparison-snapshot.repository';
import { ComparisonSnapshot, ComparisonSnapshotDocument, ComparisonSnapshotSchema } from '../../src/modules/wishlist/models/comparison-snapshot.model';
import { College, CollegeDocument, CollegeSchema } from '../../src/modules/colleges/models/college.model';
import { AuditLog, AuditLogDocument, AuditLogSchema } from '../../src/modules/colleges/models/audit-log.model';
import { CollegeRepository } from '../../src/modules/colleges/repositories/college.repository';
import { CollegeService } from '../../src/modules/colleges/services/college.service';
import { CompareLimitExceededException } from '../../src/modules/wishlist/wishlist.exceptions';

jest.setTimeout(60_000);

const STUB_ENRICHMENT: CollegeEnrichment = {
  admissionProbability: 70, admissionProbabilityBand: 'Moderate', roiPercent: 120, paybackYears: 4,
  placementPercentage: 80, aiRecommendationScore: 72, scholarshipEligible: false, scholarshipCount: 0, budgetFit: null,
};

describe('WishlistComparisonService', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let collegeModel: Model<CollegeDocument>;
  let auditModel: Model<AuditLogDocument>;
  let snapshotModel: Model<ComparisonSnapshotDocument>;
  let service: WishlistComparisonService;
  let ids: string[];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = (await mongoose.connect(mongod.getUri())).connection;
    collegeModel = connection.model(College.name, CollegeSchema) as unknown as Model<CollegeDocument>;
    auditModel = connection.model(AuditLog.name, AuditLogSchema) as unknown as Model<AuditLogDocument>;
    snapshotModel = connection.model(ComparisonSnapshot.name, ComparisonSnapshotSchema) as unknown as Model<ComparisonSnapshotDocument>;

    const collegeRepo = new CollegeRepository(collegeModel, auditModel);
    const collegeService = new CollegeService(collegeRepo, new EventEmitter2());
    const enrichmentStub = {
      enrichMany: jest.fn(async (_userId: string, colleges: CollegeDocument[]) => {
        const map = new Map<string, CollegeEnrichment>();
        for (const c of colleges) map.set(c.id, STUB_ENRICHMENT);
        return map;
      }),
    } as unknown as WishlistEnrichmentService;

    const colleges = await collegeModel.create([
      { name: 'College A', slug: 'college-a', state: 'Karnataka', city: 'Bengaluru' },
      { name: 'College B', slug: 'college-b', state: 'Karnataka', city: 'Mysuru' },
      { name: 'College C', slug: 'college-c', state: 'Karnataka', city: 'Bengaluru' },
    ]);
    ids = colleges.map(c => c.id);

    service = new WishlistComparisonService(collegeService, collegeRepo, enrichmentStub, new ComparisonSnapshotRepository(snapshotModel));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await snapshotModel.deleteMany({});
  });

  it('rejects comparing fewer than 2 colleges', async () => {
    await expect(service.compare('u1', [ids[0]])).rejects.toThrow(CompareLimitExceededException);
  });

  it('rejects comparing more than 4 colleges', async () => {
    await expect(service.compare('u1', [ids[0], ids[1], ids[2], ids[0], ids[1]])).rejects.toThrow(CompareLimitExceededException);
  });

  it('returns enriched comparison data for each college', async () => {
    const result = await service.compare('u1', [ids[0], ids[1]]);
    expect(result).toHaveLength(2);
    expect(result[0].enrichment.aiRecommendationScore).toBe(72);
    expect(result.map(r => r.college.name).sort()).toEqual(['College A', 'College B']);
  });

  it('records a comparison snapshot for history', async () => {
    await service.compare('u1', [ids[0], ids[1]], 'My comparison');
    const history = await service.listHistory('u1');
    expect(history).toHaveLength(1);
    expect(history[0].name).toBe('My comparison');
    expect(history[0].collegeNames.sort()).toEqual(['College A', 'College B']);
  });

  it('keeps comparison history scoped per user', async () => {
    await service.compare('u1', [ids[0], ids[1]]);
    await service.compare('u2', [ids[1], ids[2]]);
    expect(await service.listHistory('u1')).toHaveLength(1);
    expect(await service.listHistory('u2')).toHaveLength(1);
  });
});
