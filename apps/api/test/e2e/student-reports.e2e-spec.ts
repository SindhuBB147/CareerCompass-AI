import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, uniqueStudent } from './test-app.helper';

/**
 * End-to-end coverage for the 4 report types that used to be permanent
 * "Coming Soon" placeholders — ReportGeneratorService.buildData() threw 422
 * for all of them regardless of input. Runs through the real HTTP surface
 * (register → login → generate), not just the aggregator directly, so it
 * also exercises the controller, DTO validation, and the storage/repo layer.
 */
describe('Student Reports — new report types (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const student = uniqueStudent();
    await request(server).post('/api/v1/auth/student/register').send(student);
    const loginRes = await request(server)
      .post('/api/v1/auth/student/login')
      .send({ email: student.email, password: student.password });
    accessToken = loginRes.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  function generate(reportType: string, format = 'html') {
    return request(server)
      .post('/api/v1/student-reports/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reportType, format });
  }

  it('generates an AI Recommendation report with no prior activity (fully deterministic, no seeding required)', async () => {
    const res = await generate('ai_recommendation');
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reportType).toBe('ai_recommendation');
    expect(res.body.data.sizeBytes).toBeGreaterThan(0);
  });

  it('rejects Saved Colleges and College Comparison for a student with an empty wishlist (422, not a crash)', async () => {
    const saved = await generate('saved_colleges');
    expect(saved.status).toBe(422);
    expect(saved.body.success).toBe(false);

    const compared = await generate('college_comparison');
    expect(compared.status).toBe(422);
  });

  it('rejects Career Roadmap when no active roadmap exists yet', async () => {
    const res = await generate('career_roadmap');
    expect(res.status).toBe(422);
  });

  describe('with wishlist and roadmap data', () => {
    beforeAll(async () => {
      const collegesRes = await request(server).get('/api/v1/colleges?limit=4');
      const collegeIds: string[] = collegesRes.body.data.results.map((c: any) => c.id ?? c._id);
      expect(collegeIds.length).toBeGreaterThanOrEqual(2);

      for (const id of collegeIds.slice(0, 2)) {
        const saveRes = await request(server)
          .post(`/api/v1/wishlist/colleges/${id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({});
        expect(saveRes.status).toBe(200);
      }

      const careersRes = await request(server)
        .get('/api/v1/career-roadmap/careers')
        .set('Authorization', `Bearer ${accessToken}`);
      const careerId: string = careersRes.body.data[0].careerId ?? careersRes.body.data[0].id;
      const genRoadmapRes = await request(server)
        .post('/api/v1/career-roadmap/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ careerId });
      expect(genRoadmapRes.status).toBe(201);
    });

    it('generates a Saved Colleges report', async () => {
      const res = await generate('saved_colleges');
      expect(res.status).toBe(201);
      expect(res.body.data.reportType).toBe('saved_colleges');
    });

    it('generates a College Comparison report from the wishlist', async () => {
      const res = await generate('college_comparison');
      expect(res.status).toBe(201);
      expect(res.body.data.reportType).toBe('college_comparison');
    });

    it('generates a Career Roadmap report from the active roadmap', async () => {
      const res = await generate('career_roadmap');
      expect(res.status).toBe(201);
      expect(res.body.data.reportType).toBe('career_roadmap');
    });

    it('lists all generated reports in history', async () => {
      const res = await request(server)
        .get('/api/v1/student-reports?page=1&limit=50')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      const types = res.body.data.items.map((r: any) => r.reportType);
      expect(types).toEqual(expect.arrayContaining(['saved_colleges', 'college_comparison', 'career_roadmap', 'ai_recommendation']));
    });
  });
});
