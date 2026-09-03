import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DomainException } from '../../../common/filters/domain.exception';
import { GeneratedReportDocument, ReportFormat, ReportType } from '../models/report.model';
import { ReportRepository } from '../repositories/report.repository';
import { ReportData } from '../templates/report-data.types';
import { ReportDataAggregatorService } from './report-data-aggregator.service';
import { ReportFileStorageService } from './report-file-storage.service';
import { HtmlTemplateService } from './html-template.service';
import { PdfRendererService } from './pdf-renderer.service';
import { ExcelRendererService } from './excel-renderer.service';
import { CsvRendererService } from './csv-renderer.service';

export const CONTENT_TYPE_BY_FORMAT: Record<ReportFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  html: 'text/html',
};

/**
 * Orchestrator: aggregator builds the one ReportData shape, a renderer
 * picked by `format` turns it into bytes, storage persists it, and a
 * GeneratedReport record is written with the real byte size. No per-format
 * re-fetching — every export format renders from the exact same data.
 */
@Injectable()
export class ReportGeneratorService {
  constructor(
    private readonly aggregator: ReportDataAggregatorService,
    private readonly htmlTemplate: HtmlTemplateService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly excelRenderer: ExcelRendererService,
    private readonly csvRenderer: CsvRendererService,
    private readonly storage: ReportFileStorageService,
    private readonly repo: ReportRepository,
  ) {}

  async generate(userId: string, reportType: ReportType, format: ReportFormat, params?: Record<string, unknown>): Promise<GeneratedReportDocument> {
    const data = await this.buildData(userId, reportType, params);
    const buffer = await this.render(data, format);
    const key = `${userId}/${randomUUID()}.${format}`;
    const { sizeBytes } = await this.storage.save(buffer, key);
    return this.repo.create({
      userId, reportType, format, storageKey: key, sizeBytes,
      params: params ?? null, generatedAt: new Date(),
    });
  }

  private async buildData(userId: string, reportType: ReportType, params?: Record<string, unknown>): Promise<ReportData> {
    switch (reportType) {
      case 'admission_prediction': return this.aggregator.buildAdmissionPredictionData(userId);
      case 'financial_planning': return this.aggregator.buildFinancialPlanningData(userId, params);
      case 'scholarship_eligibility': return this.aggregator.buildScholarshipEligibilityData(userId);
      case 'student_progress': return this.aggregator.buildStudentProgressData(userId);
      default:
        throw new DomainException('UNPROCESSABLE', `Report type "${reportType}" is not yet supported.`, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  private async render(data: ReportData, format: ReportFormat): Promise<Buffer> {
    switch (format) {
      case 'pdf': return this.pdfRenderer.renderToPdf(this.htmlTemplate.render(data));
      case 'xlsx': return this.excelRenderer.renderToExcel(data);
      case 'csv': return this.csvRenderer.renderToCsv(data);
      case 'html': return Buffer.from(this.htmlTemplate.render(data), 'utf-8');
      default:
        throw new DomainException('UNPROCESSABLE', `Export format "${format}" is not supported.`, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }
}
