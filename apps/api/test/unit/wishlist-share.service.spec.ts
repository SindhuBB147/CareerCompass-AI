import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { WishlistShareService } from '../../src/modules/wishlist/services/wishlist-share.service';
import { WishlistShareRepository } from '../../src/modules/wishlist/repositories/wishlist-share.repository';
import { WishlistListRepository } from '../../src/modules/wishlist/repositories/wishlist-list.repository';
import { WishlistListItemRepository } from '../../src/modules/wishlist/repositories/wishlist-list-item.repository';
import { SavedCollegeRepository } from '../../src/modules/wishlist/repositories/saved-college.repository';
import { WishlistShare, WishlistShareDocument, WishlistShareSchema } from '../../src/modules/wishlist/models/wishlist-share.model';
import { WishlistList, WishlistListDocument, WishlistListSchema } from '../../src/modules/wishlist/models/wishlist-list.model';
import { WishlistListItem, WishlistListItemDocument, WishlistListItemSchema } from '../../src/modules/wishlist/models/wishlist-list-item.model';
import { SavedCollege, SavedCollegeDocument, SavedCollegeSchema } from '../../src/modules/wishlist/models/saved-college.model';
import { College, CollegeDocument, CollegeSchema } from '../../src/modules/colleges/models/college.model';
import { AuditLog, AuditLogDocument, AuditLogSchema } from '../../src/modules/colleges/models/audit-log.model';
import { CollegeRepository } from '../../src/modules/colleges/repositories/college.repository';
import { ShareTokenNotFoundOrExpiredException } from '../../src/modules/wishlist/wishlist.exceptions';

jest.setTimeout(60_000);

describe('WishlistShareService', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let service: WishlistShareService;
  let listRepo: WishlistListRepository;
  let listItemRepo: WishlistListItemRepository;
  let savedRepo: SavedCollegeRepository;
  let ids: string[];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = (await mongoose.connect(mongod.getUri())).connection;
    const shareModel = connection.model(WishlistShare.name, WishlistShareSchema) as unknown as Model<WishlistShareDocument>;
    const listModel = connection.model(WishlistList.name, WishlistListSchema) as unknown as Model<WishlistListDocument>;
    const listItemModel = connection.model(WishlistListItem.name, WishlistListItemSchema) as unknown as Model<WishlistListItemDocument>;
    const savedModel = connection.model(SavedCollege.name, SavedCollegeSchema) as unknown as Model<SavedCollegeDocument>;
    const collegeModel = connection.model(College.name, CollegeSchema) as unknown as Model<CollegeDocument>;
    const auditModel = connection.model(AuditLog.name, AuditLogSchema) as unknown as Model<AuditLogDocument>;

    listRepo = new WishlistListRepository(listModel);
    listItemRepo = new WishlistListItemRepository(listItemModel);
    savedRepo = new SavedCollegeRepository(savedModel);
    const collegeRepo = new CollegeRepository(collegeModel, auditModel);

    const colleges = await collegeModel.create([
      { name: 'Share College A', slug: 'share-a', state: 'Karnataka', city: 'Bengaluru' },
      { name: 'Share College B', slug: 'share-b', state: 'Karnataka', city: 'Mysuru' },
    ]);
    ids = colleges.map(c => c.id);

    service = new WishlistShareService(new WishlistShareRepository(shareModel), listRepo, listItemRepo, savedRepo, collegeRepo);
  });

  afterAll(async () => {
    if (connection) await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it('shares the full wishlist and resolves it publicly', async () => {
    await savedRepo.add('u1', ids[0]);
    await savedRepo.add('u1', ids[1]);
    const { token } = await service.createShare('u1', { kind: 'wishlist' });

    const resolved = await service.resolve(token);
    expect(resolved.kind).toBe('wishlist');
    expect(resolved.colleges.map(c => c.name).sort()).toEqual(['Share College A', 'Share College B']);
  });

  it('shares a single custom list scoped to its own colleges', async () => {
    await savedRepo.add('u2', ids[0]);
    await savedRepo.add('u2', ids[1]);
    const list = await listRepo.create({ userId: 'u2', key: null, name: 'My List', icon: '📁', type: 'custom', order: 0 });
    await listItemRepo.add('u2', list.id, ids[0]);

    const { token } = await service.createShare('u2', { kind: 'list', listId: list.id });
    const resolved = await service.resolve(token);
    expect(resolved.colleges).toHaveLength(1);
    expect(resolved.colleges[0].name).toBe('Share College A');
  });

  it('throws for an unknown token', async () => {
    await expect(service.resolve('does-not-exist')).rejects.toThrow(ShareTokenNotFoundOrExpiredException);
  });
});
