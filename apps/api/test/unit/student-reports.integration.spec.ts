import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ReportGeneratorService } from '../../src/modules/student-reports/services/report-generator.service';
import { ReportRepository } from '../../src/modules/student-reports/repositories/report.repository';
import { ReportFileStorageService } from '../../src/modules/student-reports/services/report-file-storage.service';
import { HtmlTemplateService } from '../../src/modules/student-reports/services/html-template.service';
import { PdfRendererService } from '../../src/modules/student-reports/services/pdf-renderer.service';
import { ExcelRendererService } from '../../src/modules/student-reports/services/excel-renderer.service';
import { CsvRendererService } from '../../src/modules/student-reports/services/csv-renderer.service';
import { GeneratedReport, GeneratedReportDocument, GeneratedReportSchema } from '../../src/modules/student-reports/models/report.model';
import { ReportData } from '../../src/modules/student-reports/templates/report-data.types';

jest.setTimeout(60_000);

// End-to-end (real Mongo, real Puppeteer, real disk storage — no mocks on
// the render/storage path) coverage of generate -> read-back-from-disk for
// every export format. This is the layer that actually catches the
// Puppeteer/Chromium wiring working, not just that the orchestration logic
// picks the right renderer. Mirrors the mongodb-memory-server pattern used
// by notification-flow.integration.spec.ts.
describe('Student Reports generate -> download flow (integration)', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let repo: ReportRepository;
  let storage: ReportFileStorageService;
  let tmpDir: string;
  let generator: ReportGeneratorService;
  let pdfRenderer: PdfRendererService;

  const fakeData: ReportData = {
    reportType: 'student_progress',
    reportTitle: 'Student Progress Report',
    generatedAt: new Date(),
    student: { fullName: 'Asha Rao', examProfiles: [{ examCode: 'KCET', rank: 5000 }] },
    sections: [
      { key: 'kv', title: 'Overview', kind: 'keyValue', data: [{ label: 'Profile Completion', value: '80%' }] },
      { key: 'chart', title: 'Progress Chart', kind: 'chart', data: { chartType: 'bar', data: [{ label: 'Profile', value: 80 }] } },
    ],
    aiSummary: 'You are making strong progress.',
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = (await mongoose.connect(mongod.getUri())).connection;
    const model = connection.model(GeneratedReport.name, GeneratedReportSchema) as unknown as Model<GeneratedReportDocument>;
    repo = new ReportRepository(model);

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reports-integration-'));
    const configStub = { get: (key: string) => (key === 'STUDENT_REPORTS_STORAGE_DIR' ? tmpDir : undefined) } as any;
    storage = new ReportFileStorageService(configStub);

    const aggregatorStub = { buildStudentProgressData: jest.fn().mockResolvedValue(fakeData) } as any;
    pdfRenderer = new PdfRendererService(configStub);
    generator = new ReportGeneratorService(
      aggregatorStub, new HtmlTemplateService(), pdfRenderer,
      new ExcelRendererService(), new CsvRendererService(), storage, repo,
    );
  });

  afterAll(async () => {
    if (pdfRenderer) await pdfRenderer.closeBrowser();
    if (connection) await mongoose.disconnect();
    if (mongod) await mongod.stop();
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it.each(['pdf', 'xlsx', 'csv', 'html'] as const)('generates and reads back a real %s file with the right content type signature', async format => {
    const report = await generator.generate('u1', 'student_progress', format);
    expect(report.sizeBytes).toBeGreaterThan(0);

    const buffer = await storage.read(report.storageKey);
    expect(buffer.length).toBe(report.sizeBytes);

    if (format === 'pdf') expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
    if (format === 'xlsx') expect(buffer.subarray(0, 2).toString('hex')).toBe('504b'); // ZIP/xlsx magic bytes
    if (format === 'html') expect(buffer.toString('utf-8')).toContain('<!doctype html>');
    if (format === 'csv') expect(buffer.toString('utf-8')).toContain('Asha Rao');
  });
});
