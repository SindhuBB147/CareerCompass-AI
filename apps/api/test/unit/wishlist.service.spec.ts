import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { WishlistService } from '../../src/modules/wishlist/services/wishlist.service';
import { WishlistEnrichmentService, CollegeEnrichment } from '../../src/modules/wishlist/services/wishlist-enrichment.service';
import { SavedCollegeRepository } from '../../src/modules/wishlist/repositories/saved-college.repository';
import { WishlistListRepository } from '../../src/modules/wishlist/repositories/wishlist-list.repository';
import { WishlistListItemRepository } from '../../src/modules/wishlist/repositories/wishlist-list-item.repository';
import { SavedCollege, SavedCollegeDocument, SavedCollegeSchema } from '../../src/modules/wishlist/models/saved-college.model';
import { WishlistList, WishlistListDocument, WishlistListSchema } from '../../src/modules/wishlist/models/wishlist-list.model';
import { WishlistListItem, WishlistListItemDocument, WishlistListItemSchema } from '../../src/modules/wishlist/models/wishlist-list-item.model';
import { College, CollegeDocument, CollegeSchema } from '../../src/modules/colleges/models/college.model';
import { AuditLog, AuditLogDocument, AuditLogSchema } from '../../src/modules/colleges/models/audit-log.model';
import { CollegeRepository } from '../../src/modules/colleges/repositories/college.repository';
import {
  DefaultListNotEditableException, DuplicateListNameException, ListNotFoundException, SavedCollegeNotFoundException,
} from '../../src/modules/wishlist/wishlist.exceptions';

jest.setTimeout(60_000);

const NOOP_ENRICHMENT: CollegeEnrichment = {
  admissionProbability: 72, admissionProbabilityBand: 'Moderate', roiPercent: 140, paybackYears: 3.2,
  placementPercentage: 88, aiRecommendationScore: 75, scholarshipEligible: true, scholarshipCount: 2, budgetFit: true,
};

describe('WishlistService', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let savedCollegeModel: Model<SavedCollegeDocument>;
  let listModel: Model<WishlistListDocument>;
  let listItemModel: Model<WishlistListItemDocument>;
  let collegeModel: Model<CollegeDocument>;
  let auditModel: Model<AuditLogDocument>;
  let service: WishlistService;
  let rvceId: string;
  let bmcriId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = (await mongoose.connect(mongod.getUri())).connection;
    savedCollegeModel = connection.model(SavedCollege.name, SavedCollegeSchema) as unknown as Model<SavedCollegeDocument>;
    listModel = connection.model(WishlistList.name, WishlistListSchema) as unknown as Model<WishlistListDocument>;
    listItemModel = connection.model(WishlistListItem.name, WishlistListItemSchema) as unknown as Model<WishlistListItemDocument>;
    collegeModel = connection.model(College.name, CollegeSchema) as unknown as Model<CollegeDocument>;
    auditModel = connection.model(AuditLog.name, AuditLogSchema) as unknown as Model<AuditLogDocument>;

    const collegeRepo = new CollegeRepository(collegeModel, auditModel);
    const enrichmentStub = { enrichMany: jest.fn(async (_userId: string, colleges: CollegeDocument[]) => {
      const map = new Map<string, CollegeEnrichment>();
      for (const c of colleges) map.set(c.id, NOOP_ENRICHMENT);
      return map;
    }) } as unknown as WishlistEnrichmentService;

    service = new WishlistService(
      new SavedCollegeRepository(savedCollegeModel),
      new WishlistListRepository(listModel),
      new WishlistListItemRepository(listItemModel),
      collegeRepo,
      enrichmentStub,
    );
  });

  afterAll(async () => {
    if (connection) await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      savedCollegeModel.deleteMany({}), listModel.deleteMany({}), listItemModel.deleteMany({}), collegeModel.deleteMany({}),
    ]);
    const [rvce, bmcri] = await collegeModel.create([
      {
        name: 'RV College of Engineering', slug: 'rvce', state: 'Karnataka', city: 'Bengaluru',
        collegeType: 'Autonomous', accreditation: { nirfRank: 89 }, feeBreakdown: { totalAnnualFee: 410000 },
        hostelInfo: { boysHostel: true, girlsHostel: true },
        courses: [{ courseId: 'CSE', name: 'Computer Science', degreeType: 'B.E.', durationYears: 4, intake: 240, examsAccepted: ['KCET'], discipline: 'Engineering' }],
      },
      {
        name: 'Bangalore Medical College', slug: 'bmcri', state: 'Karnataka', city: 'Bengaluru',
        collegeType: 'Government', accreditation: { nirfRank: 250 }, feeBreakdown: { totalAnnualFee: 60000 },
        hostelInfo: { boysHostel: true, girlsHostel: true },
        courses: [{ courseId: 'MBBS', name: 'MBBS', degreeType: 'MBBS', durationYears: 5, intake: 250, examsAccepted: ['NEET'], discipline: 'Medical' }],
      },
    ]);
    rvceId = rvce.id;
    bmcriId = bmcri.id;
  });

  describe('default lists', () => {
    it('lazily creates the 5 default lists on first access', async () => {
      const lists = await service.getLists('u1');
      expect(lists).toHaveLength(5);
      expect(lists.map(l => l.key).sort()).toEqual(['dream', 'favorites', 'recently_viewed', 'safe', 'target'].sort());
      expect(lists.every(l => l.itemCount === 0)).toBe(true);
    });

    it('does not duplicate default lists on repeated access', async () => {
      await service.getLists('u1');
      await service.getLists('u1');
      const lists = await service.getLists('u1');
      expect(lists).toHaveLength(5);
    });
  });

  describe('save / remove', () => {
    it('saves a college into Favorites by default', async () => {
      await service.saveCollege('u1', rvceId);
      const status = await service.getSavedStatus('u1', rvceId);
      expect(status.saved).toBe(true);
      expect(status.status).toBe('interested');

      const lists = await service.getLists('u1');
      const favorites = lists.find(l => l.key === 'favorites')!;
      expect(favorites.itemCount).toBe(1);
    });

    it('is idempotent — saving twice does not duplicate or error', async () => {
      await service.saveCollege('u1', rvceId);
      await service.saveCollege('u1', rvceId);
      const lists = await service.getLists('u1');
      expect(lists.find(l => l.key === 'favorites')!.itemCount).toBe(1);
    });

    it('removing a college clears it from every list it was in', async () => {
      await service.saveCollege('u1', rvceId);
      const dream = await service.createList('u1', 'temp-dream-check');
      await service.addToList('u1', dream.id, rvceId);

      await service.removeCollege('u1', rvceId);

      const status = await service.getSavedStatus('u1', rvceId);
      expect(status.saved).toBe(false);
      const { colleges } = await service.getWishlist('u1', {});
      expect(colleges).toHaveLength(0);
    });

    it('setStatus throws for a college that was never saved', async () => {
      await expect(service.setStatus('u1', rvceId, 'dream')).rejects.toThrow(SavedCollegeNotFoundException);
    });
  });

  describe('notes', () => {
    it('adds and removes notes on a saved college', async () => {
      await service.saveCollege('u1', rvceId);
      const note = await service.addNote('u1', rvceId, 'Visit campus');
      let status = await service.getSavedStatus('u1', rvceId);
      expect(status.notes).toHaveLength(1);
      expect(status.notes[0].text).toBe('Visit campus');

      await service.removeNote('u1', rvceId, note.id);
      status = await service.getSavedStatus('u1', rvceId);
      expect(status.notes).toHaveLength(0);
    });
  });

  describe('custom lists', () => {
    it('creates, renames, and deletes a custom list without touching SavedCollege', async () => {
      await service.saveCollege('u1', rvceId);
      const list = await service.createList('u1', 'Bangalore Colleges');
      await service.addToList('u1', list.id, rvceId);

      const renamed = await service.renameList('u1', list.id, 'Karnataka Colleges');
      expect(renamed.name).toBe('Karnataka Colleges');

      await service.deleteList('u1', list.id);
      const status = await service.getSavedStatus('u1', rvceId);
      expect(status.saved).toBe(true); // still saved overall — only removed from the deleted list
    });

    it('rejects duplicate list names (case-insensitive)', async () => {
      await service.createList('u1', 'Top Placement Colleges');
      await expect(service.createList('u1', 'top placement colleges')).rejects.toThrow(DuplicateListNameException);
    });

    it('blocks renaming or deleting a default list', async () => {
      const lists = await service.getLists('u1');
      const dream = lists.find(l => l.key === 'dream')!;
      await expect(service.renameList('u1', dream.id, 'x')).rejects.toThrow(DefaultListNotEditableException);
      await expect(service.deleteList('u1', dream.id)).rejects.toThrow(DefaultListNotEditableException);
    });

    it('duplicates a list, copying its colleges into a new list', async () => {
      await service.saveCollege('u1', rvceId);
      await service.saveCollege('u1', bmcriId);
      const original = await service.createList('u1', 'Engineering Colleges');
      await service.addToList('u1', original.id, rvceId);
      await service.addToList('u1', original.id, bmcriId);

      const copy = await service.duplicateList('u1', original.id);
      expect(copy.name).toBe('Engineering Colleges (Copy)');
      const { colleges } = await service.getWishlist('u1', { listId: copy.id });
      expect(colleges).toHaveLength(2);
    });

    it('rejects operations on a list owned by another user', async () => {
      const otherUsersList = await service.createList('u2', 'Private List');
      await expect(service.renameList('u1', otherUsersList.id, 'x')).rejects.toThrow(ListNotFoundException);
    });
  });

  describe('move between lists', () => {
    it('moves a college from one list to another', async () => {
      await service.saveCollege('u1', rvceId);
      const dream = await service.createList('u1', 'Dream Custom');
      const target = await service.createList('u1', 'Target Custom');
      await service.addToList('u1', dream.id, rvceId);

      await service.moveCollege('u1', rvceId, dream.id, target.id);

      const inDream = await service.getWishlist('u1', { listId: dream.id });
      const inTarget = await service.getWishlist('u1', { listId: target.id });
      expect(inDream.colleges).toHaveLength(0);
      expect(inTarget.colleges).toHaveLength(1);
    });
  });

  describe('getWishlist sort/filter', () => {
    beforeEach(async () => {
      await service.saveCollege('u1', rvceId);
      await service.saveCollege('u1', bmcriId);
    });

    it('sorts by NIRF rank ascending by default when requested', async () => {
      const { colleges } = await service.getWishlist('u1', { sortBy: 'nirf' });
      expect(colleges.map(c => c.college.slug)).toEqual(['rvce', 'bmcri']);
    });

    it('sorts by fees ascending', async () => {
      const { colleges } = await service.getWishlist('u1', { sortBy: 'fees' });
      expect(colleges.map(c => c.college.slug)).toEqual(['bmcri', 'rvce']);
    });

    it('filters by examCode', async () => {
      const { colleges } = await service.getWishlist('u1', { examCode: 'NEET' });
      expect(colleges).toHaveLength(1);
      expect(colleges[0].college.slug).toBe('bmcri');
    });

    it('filters by minFee/maxFee', async () => {
      const { colleges } = await service.getWishlist('u1', { maxFee: 100000 });
      expect(colleges).toHaveLength(1);
      expect(colleges[0].college.slug).toBe('bmcri');
    });

    it('attaches enrichment (admission probability / AI score) to every card', async () => {
      const { colleges } = await service.getWishlist('u1', {});
      expect(colleges.every(c => c.enrichment.aiRecommendationScore === 75)).toBe(true);
    });
  });
});
