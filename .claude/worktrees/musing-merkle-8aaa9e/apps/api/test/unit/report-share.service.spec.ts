import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { ReportShareService } from '../../src/modules/student-reports/services/report-share.service';
import { ReportRepository } from '../../src/modules/student-reports/repositories/report.repository';
import { GeneratedReport, GeneratedReportDocument, GeneratedReportSchema } from '../../src/modules/student-reports/models/report.model';

jest.setTimeout(60_000);

describe('ReportShareService', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let repo: ReportRepository;
  let service: ReportShareService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = (await mongoose.connect(mongod.getUri())).connection;
    const model = connection.model(GeneratedReport.name, GeneratedReportSchema) as unknown as Model<GeneratedReportDocument>;
    repo = new ReportRepository(model);
    const configStub = { get: () => 'http://localhost:3001' } as any;
    service = new ReportShareService(repo, configStub);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('creates a share, resolves it publicly with a sanitized projection, then disables it', async () => {
    const report = await repo.create({
      userId: 'u1', reportType: 'student_progress', format: 'pdf',
      storageKey: 'u1/report.pdf', sizeBytes: 1234, generatedAt: new Date(),
    });

    const { token, qrCodeDataUrl, expiresAt } = await service.createShare('u1', report.id);
    expect(token).toBeTruthy();
    expect(qrCodeDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const resolved = await service.resolve(token);
    expect(resolved.reportType).toBe('student_progress');
    expect(resolved.sizeBytes).toBe(1234);
    expect((resolved as any).userId).toBeUndefined();
    expect((resolved as any).storageKey).toBeUndefined();

    await service.disableShare('u1', report.id);
    await expect(service.resolve(token)).rejects.toThrow();
  });

  it('rejects an expired share token', async () => {
    const report = await repo.create({
      userId: 'u2', reportType: 'financial_planning', format: 'xlsx',
      storageKey: 'u2/report.xlsx', sizeBytes: 500,
      shareToken: 'expired-token', shareEnabled: true,
      shareExpiresAt: new Date(Date.now() - 1000),
      generatedAt: new Date(),
    });
    expect(report.shareToken).toBe('expired-token');
    await expect(service.resolve('expired-token')).rejects.toThrow();
  });

  it('throws for an unknown token', async () => {
    await expect(service.resolve('does-not-exist')).rejects.toThrow();
  });
});
