import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Req, Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuditAction, Public } from '../../common/decorators/auth.decorators';
import { AccessTokenPayload } from '../auth/services/token.service';
import { DomainException } from '../../common/filters/domain.exception';
import { ReportGeneratorService, CONTENT_TYPE_BY_FORMAT } from './services/report-generator.service';
import { ReportRepository } from './repositories/report.repository';
import { ReportFileStorageService } from './services/report-file-storage.service';
import { ReportShareService } from './services/report-share.service';
import { ReportEmailService } from './services/report-email.service';
import { GenerateReportDto, EmailReportDto, ReportListQueryDto } from './dto/student-reports.dto';
import { GeneratedReportDocument, ReportFormat, ReportType } from './models/report.model';

type AuthReq = Request & { user: AccessTokenPayload };

@Controller('student-reports')
export class StudentReportsController {
  constructor(
    private readonly generator: ReportGeneratorService,
    private readonly repo: ReportRepository,
    private readonly storage: ReportFileStorageService,
    private readonly share: ReportShareService,
    private readonly emailService: ReportEmailService,
  ) {}

  @Post('generate')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @AuditAction('report_generated')
  async generate(@Body() dto: GenerateReportDto, @Req() req: AuthReq) {
    const report = await this.generator.generate(req.user.sub, dto.reportType as ReportType, dto.format as ReportFormat, dto.params);
    return { success: true, data: this.toMetadata(report) };
  }

  @Get()
  async list(@Query() q: ReportListQueryDto, @Req() req: AuthReq) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const [items, total] = await Promise.all([
      this.repo.listForUser(req.user.sub, page, limit),
      this.repo.countForUser(req.user.sub),
    ]);
    return { success: true, data: { items: items.map(r => this.toMetadata(r)), page, limit, total } };
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Req() req: AuthReq) {
    const report = await this.findOwned(req.user.sub, id);
    return { success: true, data: this.toMetadata(report) };
  }

  @Get(':id/download')
  @AuditAction('report_downloaded')
  async download(@Param('id') id: string, @Req() req: AuthReq, @Res() res: Response) {
    const report = await this.findOwned(req.user.sub, id);
    const buffer = await this.storage.read(report.storageKey);
    await this.repo.incrementDownloadCount(report.id);
    this.sendFile(res, report, buffer);
  }

  @Get(':id/preview')
  async preview(@Param('id') id: string, @Req() req: AuthReq, @Res() res: Response) {
    const report = await this.findOwned(req.user.sub, id);
    if (report.format !== 'html') {
      throw new DomainException('UNPROCESSABLE', 'Only HTML-format reports can be previewed inline — download PDF/Excel/CSV reports instead.', HttpStatus.BAD_REQUEST);
    }
    const buffer = await this.storage.read(report.storageKey);
    res.set('Content-Type', 'text/html');
    res.send(buffer);
  }

  @Post(':id/regenerate')
  @AuditAction('report_generated')
  async regenerate(@Param('id') id: string, @Req() req: AuthReq) {
    const existing = await this.findOwned(req.user.sub, id);
    const fresh = await this.generator.generate(req.user.sub, existing.reportType, existing.format, existing.params ?? undefined);
    return { success: true, data: this.toMetadata(fresh) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @AuditAction('report_deleted')
  async remove(@Param('id') id: string, @Req() req: AuthReq) {
    const report = await this.findOwned(req.user.sub, id);
    await this.storage.delete(report.storageKey);
    await this.repo.deleteForUser(req.user.sub, id);
    return { success: true, data: { deleted: true } };
  }

  @Post(':id/share')
  @AuditAction('report_shared')
  async createShare(@Param('id') id: string, @Req() req: AuthReq) {
    return { success: true, data: await this.share.createShare(req.user.sub, id) };
  }

  @Delete(':id/share')
  @HttpCode(HttpStatus.OK)
  @AuditAction('report_shared')
  async disableShare(@Param('id') id: string, @Req() req: AuthReq) {
    await this.share.disableShare(req.user.sub, id);
    return { success: true, data: { shareEnabled: false } };
  }

  @Post(':id/email')
  @AuditAction('report_emailed')
  async email(@Param('id') id: string, @Body() dto: EmailReportDto, @Req() req: AuthReq) {
    await this.emailService.email(req.user.sub, id, dto.to);
    return { success: true, data: { sent: true } };
  }

  // ── Public share resolution — bypasses the global JwtAuthGuard ─────────

  @Get('shared/:token')
  @Public()
  async getShared(@Param('token') token: string) {
    return { success: true, data: await this.share.resolve(token) };
  }

  @Get('shared/:token/download')
  @Public()
  async downloadShared(@Param('token') token: string, @Res() res: Response) {
    const report = await this.share.resolveValidReport(token);
    const buffer = await this.storage.read(report.storageKey);
    this.sendFile(res, report, buffer);
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private async findOwned(userId: string, id: string): Promise<GeneratedReportDocument> {
    const report = await this.repo.findByIdForUser(userId, id);
    if (!report) throw new DomainException('NOT_FOUND', 'Report not found.', HttpStatus.NOT_FOUND);
    return report;
  }

  private sendFile(res: Response, report: GeneratedReportDocument, buffer: Buffer): void {
    res.set({
      'Content-Type': CONTENT_TYPE_BY_FORMAT[report.format],
      // 'inline' (not 'attachment') so PDF/HTML can render inside the
      // shared report page's <iframe> — an 'attachment' disposition makes
      // browsers refuse to embed the response at all. The authenticated
      // Reports Center's Download button doesn't rely on this header (it
      // fetches as a Blob and forces a save via the anchor `download`
      // attribute instead — see downloadAuthenticated() in reports-api.ts),
      // and the public shared page's Download link sets its own `download`
      // attribute for the same reason.
      'Content-Disposition': `inline; filename="${report.reportType}-${report.id}.${report.format}"`,
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
  }

  private toMetadata(report: GeneratedReportDocument) {
    return {
      id: report.id,
      reportType: report.reportType,
      format: report.format,
      sizeBytes: report.sizeBytes,
      downloadCount: report.downloadCount,
      generatedAt: report.generatedAt,
      shareEnabled: report.shareEnabled,
      shareToken: report.shareEnabled ? report.shareToken : null,
      shareExpiresAt: report.shareExpiresAt,
    };
  }
}
