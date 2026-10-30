import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { CollegeRepository } from '../../src/modules/colleges/repositories/college.repository';
import { College, CollegeDocument, CollegeSchema } from '../../src/modules/colleges/models/college.model';
import { AuditLog, AuditLogDocument, AuditLogSchema } from '../../src/modules/colleges/models/audit-log.model';

jest.setTimeout(60_000);

describe('CollegeRepository', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let collegeModel: Model<CollegeDocument>;
  let auditModel: Model<AuditLogDocument>;
  let repo: CollegeRepository;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = (await mongoose.connect(mongod.getUri())).connection;
    collegeModel = connection.model(College.name, CollegeSchema) as unknown as Model<CollegeDocument>;
    auditModel = connection.model(AuditLog.name, AuditLogSchema) as unknown as Model<AuditLogDocument>;
    repo = new CollegeRepository(collegeModel, auditModel);
  });

  afterAll(async () => {
    if (connection) await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await collegeModel.deleteMany({});
    await collegeModel.create([
      {
        name: 'RV College of Engineering', slug: 'rvce', aliasNames: ['RV Engineering College'], state: 'Karnataka', city: 'Bengaluru',
        district: 'Bengaluru Urban', collegeType: 'Autonomous', aicteApproved: true,
        accreditation: { naac: 'A++', nbaCourses: ['CSE'], nirfRank: 89 },
        feeBreakdown: { totalAnnualFee: 410000 },
        hostelInfo: { boysHostel: true, girlsHostel: true },
        courses: [{ courseId: 'CSE', name: 'Computer Science & Engineering', degreeType: 'B.E.', durationYears: 4, intake: 240, examsAccepted: ['KCET', 'COMEDK'], discipline: 'Engineering' }],
      },
      {
        name: 'Bangalore Medical College', slug: 'bmcri', state: 'Karnataka', city: 'Bengaluru',
        district: 'Bengaluru Urban', collegeType: 'Government', aicteApproved: true,
        accreditation: { naac: 'A', nbaCourses: [], nirfRank: 250 },
        feeBreakdown: { totalAnnualFee: 60000 },
        hostelInfo: { boysHostel: true, girlsHostel: true },
        courses: [{ courseId: 'MBBS', name: 'Bachelor of Medicine, Bachelor of Surgery', degreeType: 'MBBS', durationYears: 5, intake: 250, examsAccepted: ['NEET'], discipline: 'Medical' }],
      },
      {
        name: 'RajaRajeswari College of Nursing', slug: 'rr-nursing', state: 'Karnataka', city: 'Bengaluru',
        district: 'Bengaluru Urban', collegeType: 'Private', aicteApproved: false,
        accreditation: { naac: 'B++', nbaCourses: [], nirfRank: 400 },
        feeBreakdown: { totalAnnualFee: 154000 },
        hostelInfo: { boysHostel: false, girlsHostel: true },
        courses: [{ courseId: 'BSCN', name: 'Bachelor of Science in Nursing', degreeType: 'B.Sc Nursing', durationYears: 4, intake: 100, examsAccepted: ['KCET', 'NEET'], discipline: 'Nursing' }],
      },
    ]);
  });

  describe('search', () => {
    it('filters by examCode', async () => {
      const { results, totalResults } = await repo.search({ examCode: 'NEET', page: 1, limit: 20 });
      expect(totalResults).toBe(2);
      expect(results.map(r => r.slug).sort()).toEqual(['bmcri', 'rr-nursing']);
    });

    it('matches partial names, cities, districts, aliases and course names case-insensitively', async () => {
      const nameMatches = await repo.search({ q: 'rv college', page: 1, limit: 20 });
      const cityMatches = await repo.search({ q: 'BENGALURU', page: 1, limit: 20 });
      const districtMatches = await repo.search({ q: 'urban', page: 1, limit: 20 });
      const aliasMatches = await repo.search({ q: 'rv engineering', page: 1, limit: 20 });
      const courseMatches = await repo.search({ q: 'computer science', page: 1, limit: 20 });

      expect(nameMatches.results.map(c => c.slug)).toEqual(['rvce']);
      expect(cityMatches.totalResults).toBe(3);
      expect(districtMatches.totalResults).toBe(3);
      expect(aliasMatches.results.map(c => c.slug)).toEqual(['rvce']);
      expect(courseMatches.results.map(c => c.slug)).toEqual(['rvce']);
    });

    it('uses city when a college has no district and treats location filters as partial text', async () => {
      await collegeModel.create({
        name: 'City Only College', slug: 'city-only', state: 'Karnataka', city: 'Bengaluru',
        collegeType: 'Private', courses: [],
      });

      const cityResults = await repo.search({ city: 'BENG', page: 1, limit: 20 });
      const districtResults = await repo.search({ district: 'Bengaluru', page: 1, limit: 20 });
      expect(cityResults.totalResults).toBe(4);
      expect(districtResults.results.map(c => c.slug)).toContain('city-only');
    });

    it('trims whitespace and escapes user-provided regular-expression characters', async () => {
      const whitespace = await repo.search({ q: '   ', page: 1, limit: 20 });
      const literal = await repo.search({ q: '[', page: 1, limit: 20 });
      expect(whitespace.totalResults).toBe(3);
      expect(literal.totalResults).toBe(0);
    });

    it('filters by discipline', async () => {
      const { results } = await repo.search({ discipline: 'Medical', page: 1, limit: 20 });
      expect(results).toHaveLength(1);
      expect(results[0].slug).toBe('bmcri');
    });

    it('treats a course with no discipline field set as Engineering when filtering for Engineering', async () => {
      // Course.discipline defaults to 'Engineering' in the schema, but real
      // seeded data can still omit it outright (see college.repository.ts's
      // discipline-filter comment) — an explicit "Engineering" filter must
      // still find those courses, mirroring predictions' course-matcher.util.ts.
      await collegeModel.create({
        name: 'Undisciplined Institute of Technology', slug: 'undisciplined-tech', state: 'Karnataka', city: 'Bengaluru',
        collegeType: 'Private',
        courses: [{ courseId: 'CSE2', name: 'Computer Science', degreeType: 'B.E.', durationYears: 4, intake: 60, examsAccepted: ['KCET'] }],
      });
      const { results } = await repo.search({ discipline: 'Engineering', page: 1, limit: 20 });
      expect(results.map(r => r.slug)).toContain('undisciplined-tech');
      expect(results.map(r => r.slug)).toContain('rvce');
    });

    it('does not let a missing discipline field leak into non-Engineering discipline filters', async () => {
      await collegeModel.create({
        name: 'Undisciplined Institute of Technology', slug: 'undisciplined-tech', state: 'Karnataka', city: 'Bengaluru',
        collegeType: 'Private',
        courses: [{ courseId: 'CSE2', name: 'Computer Science', degreeType: 'B.E.', durationYears: 4, intake: 60, examsAccepted: ['KCET'] }],
      });
      const { results } = await repo.search({ discipline: 'Medical', page: 1, limit: 20 });
      expect(results.map(r => r.slug)).not.toContain('undisciplined-tech');
    });

    it('filters by nbaOnly', async () => {
      const { results } = await repo.search({ nbaOnly: true, page: 1, limit: 20 });
      expect(results).toHaveLength(1);
      expect(results[0].slug).toBe('rvce');
    });

    it('filters by aicteApproved', async () => {
      const { results } = await repo.search({ aicteApproved: false, page: 1, limit: 20 });
      expect(results).toHaveLength(1);
      expect(results[0].slug).toBe('rr-nursing');
    });

    it('filters by hostelAvailable without breaking free-text search ($and vs $or)', async () => {
      // rr-nursing has no boys hostel but does have a girls hostel — should still match.
      const { results } = await repo.search({ q: 'Nursing', hostelAvailable: true, page: 1, limit: 20 });
      expect(results.map(r => r.slug)).toEqual(['rr-nursing']);
    });

    it('filters by a comma-separated list of college types', async () => {
      const { results } = await repo.search({ collegeType: 'Government,Private', page: 1, limit: 20 });
      expect(results.map(r => r.slug).sort()).toEqual(['bmcri', 'rr-nursing']);
    });

    it('filters by max annual fee', async () => {
      const { results } = await repo.search({ maxFee: 100000, page: 1, limit: 20 });
      expect(results).toHaveLength(1);
      expect(results[0].slug).toBe('bmcri');
    });

    it('sorts by nirf rank ascending, unranked colleges last-ish via default', async () => {
      const { results } = await repo.search({ sortBy: 'nirf', page: 1, limit: 20 });
      expect(results[0].slug).toBe('rvce');
    });

    it('paginates results', async () => {
      const page1 = await repo.search({ page: 1, limit: 2 });
      const page2 = await repo.search({ page: 2, limit: 2 });
      expect(page1.results).toHaveLength(2);
      expect(page2.results).toHaveLength(1);
      expect(page1.totalResults).toBe(3);
    });
  });

  describe('getFacets', () => {
    it('returns global facets across all colleges when no examCode is given', async () => {
      const facets = await repo.getFacets();
      expect(facets.collegeTypes.sort()).toEqual(['Autonomous', 'Government', 'Private']);
      expect(facets.disciplines.sort()).toEqual(['Engineering', 'Medical', 'Nursing']);
    });

    it('scopes facets to only colleges/courses accepting the given exam', async () => {
      const facets = await repo.getFacets('NEET');
      expect(facets.disciplines.sort()).toEqual(['Medical', 'Nursing']);
      expect(facets.branches).not.toContain('Computer Science & Engineering');
    });

    it('scopes facets to KCET, excluding NEET-only medical courses', async () => {
      const facets = await repo.getFacets('KCET');
      expect(facets.disciplines.sort()).toEqual(['Engineering', 'Nursing']);
    });
  });
});
