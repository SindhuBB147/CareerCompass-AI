import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { RecentlyViewedService } from '../../src/modules/wishlist/services/recently-viewed.service';
import { RecentlyViewedRepository } from '../../src/modules/wishlist/repositories/recently-viewed.repository';
import { RecentlyViewedCollege, RecentlyViewedCollegeDocument, RecentlyViewedCollegeSchema } from '../../src/modules/wishlist/models/recently-viewed-college.model';
import { College, CollegeDocument, CollegeSchema } from '../../src/modules/colleges/models/college.model';
import { AuditLog, AuditLogDocument, AuditLogSchema } from '../../src/modules/colleges/models/audit-log.model';
import { CollegeRepository } from '../../src/modules/colleges/repositories/college.repository';

jest.setTimeout(60_000);

describe('RecentlyViewedService', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let rvModel: Model<RecentlyViewedCollegeDocument>;
  let collegeModel: Model<CollegeDocument>;
  let auditModel: Model<AuditLogDocument>;
  let service: RecentlyViewedService;
  let ids: string[];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = (await mongoose.connect(mongod.getUri())).connection;
    rvModel = connection.model(RecentlyViewedCollege.name, RecentlyViewedCollegeSchema) as unknown as Model<RecentlyViewedCollegeDocument>;
    collegeModel = connection.model(College.name, CollegeSchema) as unknown as Model<CollegeDocument>;
    auditModel = connection.model(AuditLog.name, AuditLogSchema) as unknown as Model<AuditLogDocument>;

    const colleges = await collegeModel.create(
      Array.from({ length: 3 }, (_, i) => ({ name: `College ${i}`, slug: `college-${i}`, state: 'Karnataka', city: 'Bengaluru' })),
    );
    ids = colleges.map(c => c.id);

    service = new RecentlyViewedService(new RecentlyViewedRepository(rvModel), new CollegeRepository(collegeModel, auditModel));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await rvModel.deleteMany({});
  });

  it('records a view and lists it with the populated college', async () => {
    await service.record('u1', ids[0]);
    const items = await service.list('u1');
    expect(items).toHaveLength(1);
    expect(items[0].college.name).toBe('College 0');
  });

  it('re-viewing a college bumps it to the top without duplicating', async () => {
    await service.record('u1', ids[0]);
    await service.record('u1', ids[1]);
    await service.record('u1', ids[0]);
    const items = await service.list('u1');
    expect(items).toHaveLength(2);
    expect(items[0].collegeId).toBe(ids[0]);
  });

  it('clear() removes all history for a user without touching other users', async () => {
    await service.record('u1', ids[0]);
    await service.record('u2', ids[1]);
    await service.clear('u1');
    expect(await service.list('u1')).toHaveLength(0);
    expect(await service.list('u2')).toHaveLength(1);
  });
});
