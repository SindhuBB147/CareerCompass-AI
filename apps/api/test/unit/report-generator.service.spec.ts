import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { ReportGeneratorService } from '../../src/modules/student-reports/services/report-generator.service';
import { ReportRepository } from '../../src/modules/student-reports/repositories/report.repository';
import { ReportFileStorageService } from '../../src/modules/student-reports/services/report-file-storage.service';
import { HtmlTemplateService } from '../../src/modules/student-reports/services/html-template.service';
import { CsvRendererService } from '../../src/modules/student-reports/services/csv-renderer.service';
import { ExcelRendererService } from '../../src/modules/student-reports/services/excel-renderer.service';
import { GeneratedReport, GeneratedReportDocument, GeneratedReportSchema } from '../../src/modules/student-reports/models/report.model';
import { ReportData } from '../../src/modules/student-reports/templates/report-data.types';

jest.setTimeout(60_000);

describe('ReportGeneratorService', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let repo: ReportRepository;
  let storage: ReportFileStorageService;
  let tmpDir: string;
  let generator: ReportGeneratorService;
  let aggregatorStub: any;

  const fakeData: ReportData = {
    reportType: 'student_progress',
    reportTitle: 'Student Progress Report',
    generatedAt: new Date(),
    student: { fullName: 'Asha Rao', examProfiles: [] },
    sections: [{ key: 'kv', title: 'Overview', kind: 'keyValue', data: [{ label: 'Profile Completion', value: '80%' }] }],
    aiSummary: 'Summary text.',
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = (await mongoose.connect(mongod.getUri())).connection;
    const model = connection.model(GeneratedReport.name, GeneratedReportSchema) as unknown as Model<GeneratedReportDocument>;
    repo = new ReportRepository(model);

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reports-test-'));
    const configStub = { get: (key: string) => (key === 'STUDENT_REPORTS_STORAGE_DIR' ? tmpDir : undefined) } as any;
    storage = new ReportFileStorageService(configStub);

    aggregatorStub = {
      buildAdmissionPredictionData: jest.fn().mockResolvedValue(fakeData),
      buildFinancialPlanningData: jest.fn().mockResolvedValue(fakeData),
      buildScholarshipEligibilityData: jest.fn().mockResolvedValue(fakeData),
      buildStudentProgressData: jest.fn().mockResolvedValue(fakeData),
    };

    const pdfRendererStub = { renderToPdf: jest.fn() } as any;
    generator = new ReportGeneratorService(
      aggregatorStub, new HtmlTemplateService(), pdfRendererStub,
      new ExcelRendererService(), new CsvRendererService(), storage, repo,
    );
  });

  afterAll(async () => {
    if (connection) await mongoose.disconnect();
    if (mongod) await mongod.stop();
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('generates a CSV report end-to-end with a real byte size and correct storage key shape', async () => {
    const report = await generator.generate('u1', 'student_progress', 'csv');
    expect(report.userId).toBe('u1');
    expect(report.format).toBe('csv');
    expect(report.sizeBytes).toBeGreaterThan(0);
    expect(report.storageKey).toMatch(/^u1\/[0-9a-f-]+\.csv$/);
    expect(aggregatorStub.buildStudentProgressData).toHaveBeenCalledWith('u1');

    const onDisk = await storage.read(report.storageKey);
    expect(onDisk.length).toBe(report.sizeBytes);
  });

  it('generates an xlsx report using the excel renderer, never touching Puppeteer', async () => {
    const report = await generator.generate('u1', 'student_progress', 'xlsx');
    expect(report.format).toBe('xlsx');
    expect(report.sizeBytes).toBeGreaterThan(0);
    expect((generator as any).pdfRenderer?.renderToPdf).not.toHaveBeenCalled();
  });

  it('routes financial_planning report type with params to the aggregator', async () => {
    await generator.generate('u2', 'financial_planning', 'csv', { hostelRequired: true });
    expect(aggregatorStub.buildFinancialPlanningData).toHaveBeenCalledWith('u2', { hostelRequired: true });
  });

  it('throws for an unsupported report type', async () => {
    await expect(generator.generate('u1', 'college_comparison' as any, 'csv')).rejects.toThrow();
  });
});
