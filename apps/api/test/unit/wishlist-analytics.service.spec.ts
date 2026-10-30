import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { WishlistAnalyticsService } from '../../src/modules/wishlist/services/wishlist-analytics.service';
import { WishlistListItemRepository } from '../../src/modules/wishlist/repositories/wishlist-list-item.repository';
import { ComparisonSnapshotRepository } from '../../src/modules/wishlist/repositories/comparison-snapshot.repository';
import { SavedCollegeRepository } from '../../src/modules/wishlist/repositories/saved-college.repository';
import { SavedCollege, SavedCollegeDocument, SavedCollegeSchema } from '../../src/modules/wishlist/models/saved-college.model';
import { WishlistList, WishlistListDocument, WishlistListSchema } from '../../src/modules/wishlist/models/wishlist-list.model';
import { WishlistListItem, WishlistListItemDocument, WishlistListItemSchema } from '../../src/modules/wishlist/models/wishlist-list-item.model';
import { ComparisonSnapshot, ComparisonSnapshotDocument, ComparisonSnapshotSchema } from '../../src/modules/wishlist/models/comparison-snapshot.model';
import { College, CollegeDocument, CollegeSchema } from '../../src/modules/colleges/models/college.model';
import { AuditLog, AuditLogDocument, AuditLogSchema } from '../../src/modules/colleges/models/audit-log.model';
import { CollegeRepository } from '../../src/modules/colleges/repositories/college.repository';

jest.setTimeout(60_000);

describe('WishlistAnalyticsService', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let savedModel: Model<SavedCollegeDocument>;
  let listModel: Model<WishlistListDocument>;
  let listItemModel: Model<WishlistListItemDocument>;
  let snapshotModel: Model<ComparisonSnapshotDocument>;
  let service: WishlistAnalyticsService;
  let ids: string[];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = (await mongoose.connect(mongod.getUri())).connection;
    savedModel = connection.model(SavedCollege.name, SavedCollegeSchema) as unknown as Model<SavedCollegeDocument>;
    listModel = connection.model(WishlistList.name, WishlistListSchema) as unknown as Model<WishlistListDocument>;
    listItemModel = connection.model(WishlistListItem.name, WishlistListItemSchema) as unknown as Model<WishlistListItemDocument>;
    snapshotModel = connection.model(ComparisonSnapshot.name, ComparisonSnapshotSchema) as unknown as Model<ComparisonSnapshotDocument>;
    const collegeModel = connection.model(College.name, CollegeSchema) as unknown as Model<CollegeDocument>;
    const auditModel = connection.model(AuditLog.name, AuditLogSchema) as unknown as Model<AuditLogDocument>;
    const collegeRepo = new CollegeRepository(collegeModel, auditModel);

    const colleges = await collegeModel.create([
      { name: 'Popular College', slug: 'popular', state: 'Karnataka', city: 'Bengaluru' },
      { name: 'Niche College', slug: 'niche', state: 'Karnataka', city: 'Mysuru' },
    ]);
    ids = colleges.map(c => c.id);

    const userRepoStub = { searchByNameOrEmail: jest.fn().mockResolvedValue([]), findByIds: jest.fn().mockResolvedValue([]) } as any;
    service = new WishlistAnalyticsService(
      savedModel,
      new WishlistListItemRepository(listItemModel),
      new ComparisonSnapshotRepository(snapshotModel),
      new SavedCollegeRepository(savedModel),
      collegeRepo,
      userRepoStub,
    );
  });

  afterAll(async () => {
    if (connection) await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([savedModel.deleteMany({}), listModel.deleteMany({}), listItemModel.deleteMany({}), snapshotModel.deleteMany({})]);
  });

  it('ranks most-saved colleges across users', async () => {
    await savedModel.create([
      { userId: 'u1', collegeId: ids[0] }, { userId: 'u2', collegeId: ids[0] }, { userId: 'u3', collegeId: ids[1] },
    ]);
    const { mostSaved } = await service.getAnalytics();
    expect(mostSaved[0]).toMatchObject({ collegeId: ids[0], collegeName: 'Popular College', saves: 2 });
  });

  it('reports bookmark status breakdown', async () => {
    await savedModel.create([
      { userId: 'u1', collegeId: ids[0], status: 'dream' },
      { userId: 'u2', collegeId: ids[1], status: 'dream' },
      { userId: 'u3', collegeId: ids[1], status: 'applied' },
    ]);
    const { bookmarkStatusBreakdown } = await service.getAnalytics();
    const dream = bookmarkStatusBreakdown.find(s => s.status === 'dream');
    expect(dream?.count).toBe(2);
  });

  it('reports most-compared colleges from comparison snapshots', async () => {
    const snapshotRepo = new ComparisonSnapshotRepository(snapshotModel);
    await snapshotRepo.record('u1', [ids[0], ids[1]]);
    await snapshotRepo.record('u2', [ids[0]]);
    const { mostCompared } = await service.getAnalytics();
    expect(mostCompared[0]).toMatchObject({ collegeId: ids[0], comparisons: 2 });
  });

  it('reports popular lists by item count', async () => {
    const list = await listModel.create({ userId: 'u1', key: null, name: 'Engineering Colleges', icon: '📁', type: 'custom', order: 0 });
    const listItemRepo = new WishlistListItemRepository(listItemModel);
    await listItemRepo.add('u1', list.id, ids[0]);
    await listItemRepo.add('u1', list.id, ids[1]);
    const { popularLists } = await service.getAnalytics();
    expect(popularLists[0]).toMatchObject({ name: 'Engineering Colleges', count: 2 });
  });
});
