import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { CutoffService } from './cutoff.service';
import { CutoffPdfGeneratorService } from './cutoff-pdf-generator.service';
import { CutoffFileParserService } from './cutoff-file-parser.service';
import {
  BulkRowDto,
  BulkUploadDto,
  CutoffPdfExportQueryDto,
  CutoffQueryDto,
  CutoffTrendQueryDto,
  ResolveConflictDto,
  UpdateCutoffDto,
  UpdateCutoffStatusDto,
  ValidateRowsDto,
} from './cutoff.dto';
import { Public, Roles, RequirePermissions } from '../../common/decorators/auth.decorators';
import { PERMISSIONS } from '../../common/permissions';
import { DomainException } from '../../common/filters/domain.exception';
import { AccessTokenPayload } from '../auth/services/token.service';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type AdminReq = Request & { user: AccessTokenPayload };

@Controller('colleges/:collegeId/cutoffs')
export class CutoffController {
  constructor(
    private readonly svc: CutoffService,
    private readonly pdfGenerator: CutoffPdfGeneratorService,
  ) {}

  @Get() @Public()
  async getCutoffs(@Param('collegeId') cid: string, @Query() q: CutoffQueryDto) {
    const data = await this.svc.getFilteredCutoffs(cid, q);
    return { success: true, data };
  }

  @Get('facets') @Public()
  async getFacets(@Param('collegeId') cid: string, @Query('examCode') examCode?: string) {
    const facets = await this.svc.getFacets(cid, examCode);
    return { success: true, data: facets };
  }

  @Get('summary') @Public()
  async getSummary(
    @Param('collegeId') cid: string,
    @Query('examCode') examCode?: string,
    @Query('courseId') courseId?: string,
    @Query('category') category?: string,
  ) {
    const summary = await this.svc.getSummary(cid, examCode, courseId, category);
    return { success: true, data: summary };
  }

  @Get('trends') @Public()
  async getTrends(@Param('collegeId') cid: string, @Query() q: CutoffTrendQueryDto) {
    const trends = await this.svc.getTrends(cid, q.courseId, q.examCode, q.category);
    return { success: true, data: trends };
  }

  @Get('insights') @Public()
  async getAIInsights(
    @Param('collegeId') cid: string,
    @Query('courseId') courseId?: string,
    @Query('examCode') examCode?: string,
    @Query('category') category: string = 'GM',
  ) {
    const insights = await this.svc.getAIInsights(cid, courseId, examCode, category);
    return { success: true, data: insights };
  }

  @Get('export/pdf') @Public()
  async exportPdf(
    @Param('collegeId') cid: string,
    @Query() q: CutoffPdfExportQueryDto,
    @Res() res: Response,
  ) {
    const pdf = await this.pdfGenerator.generatePdf({ ...q, collegeId: cid });
    res.setHeader('Content-Type', pdf.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
    res.send(pdf.buffer);
  }
}

@Controller('cutoffs')
export class GenericCutoffController {
  constructor(
    private readonly pdfGenerator: CutoffPdfGeneratorService,
    private readonly svc: CutoffService,
  ) {}

  @Get('export/pdf') @Public()
  async exportPdfGlobal(@Query() q: CutoffPdfExportQueryDto, @Res() res: Response) {
    const cid = q.collegeId || 'E001';
    const pdf = await this.pdfGenerator.generatePdf({ ...q, collegeId: cid });
    res.setHeader('Content-Type', pdf.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
    res.send(pdf.buffer);
  }

  @Get('categories') @Public()
  async getCategories(@Query('examCode') examCode: string = 'KCET') {
    return { success: true, data: { categories: this.svc.getExamCategories(examCode) } };
  }
}

@Controller('admin/cutoffs')
export class AdminCutoffController {
  constructor(
    private readonly svc: CutoffService,
    private readonly fileParser: CutoffFileParserService,
  ) {}

  @Get('dashboard') @Roles('data_manager', 'super_admin')
  async getDashboard() {
    const data = await this.svc.getDashboardStats();
    return { success: true, data };
  }

  @Post('parse-file') @Roles('data_manager', 'super_admin')
  @UseInterceptors(FileInterceptor('file'))
  async parseFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new DomainException('VALIDATION_ERROR', 'A file is required.', HttpStatus.BAD_REQUEST);
    if (file.size > MAX_UPLOAD_BYTES) throw new DomainException('VALIDATION_ERROR', 'File exceeds the 10MB upload limit.', HttpStatus.BAD_REQUEST);
    const data = await this.fileParser.parse(file.buffer, file.originalname);
    return { success: true, data };
  }

  @Post('bulk-upload/validate') @Roles('data_manager', 'super_admin')
  async validateBulkUpload(@Body() dto: ValidateRowsDto) {
    const data = await this.svc.validateRows(dto.rows);
    return { success: true, data };
  }

  @Post('import') @Roles('data_manager', 'super_admin')
  async importCutoffs(@Body() dto: BulkUploadDto, @Req() req: AdminReq) {
    const adminId = req.user?.sub || 'admin';
    const report = await this.svc.bulkUpload(dto.rows, dto.fileName || 'import.csv', dto.overwriteExisting ?? true, adminId);
    return { success: true, data: report };
  }

  @Post('bulk-upload') @Roles('data_manager', 'super_admin')
  async bulkUpload(@Body() dto: BulkUploadDto, @Req() req: AdminReq) {
    const adminId = req.user?.sub || 'admin';
    const report = await this.svc.bulkUpload(dto.rows, dto.fileName || 'bulk_upload.csv', dto.overwriteExisting ?? true, adminId);
    return { success: true, data: report };
  }

  @Get('imports') @Roles('data_manager', 'super_admin')
  async listImports() {
    const logs = await this.svc.listImports();
    return { success: true, data: { imports: logs } };
  }

  @Post('imports/:importId/rollback') @Roles('data_manager', 'super_admin')
  async rollbackImport(@Param('importId') importId: string, @Req() req: AdminReq) {
    const result = await this.svc.rollbackImport(importId, req.user?.sub || 'admin');
    return { success: true, data: result };
  }

  @Get('conflicts') @Roles('data_manager', 'super_admin')
  async listConflicts() {
    return { success: true, data: { conflicts: await this.svc.listOpenConflicts() } };
  }

  @Patch('conflicts/:id/resolve') @Roles('data_manager', 'super_admin')
  async resolve(@Param('id') id: string, @Body() dto: ResolveConflictDto, @Req() req: AdminReq) {
    await this.svc.resolveConflict(id, dto.resolvedValue, req.user?.sub || 'admin');
    return { success: true, data: { conflictId: id, status: 'resolved' } };
  }

  @Post() @Roles('data_manager', 'super_admin')
  async createCutoff(@Body() dto: BulkRowDto, @Req() req: AdminReq) {
    const cutoff = await this.svc.createCutoff(dto, req.user?.sub || 'admin');
    return { success: true, data: cutoff };
  }

  @Put(':id') @Roles('data_manager', 'super_admin')
  async updateCutoff(@Param('id') id: string, @Body() dto: UpdateCutoffDto, @Req() req: AdminReq) {
    const cutoff = await this.svc.updateCutoff(id, dto, req.user?.sub || 'admin');
    return { success: true, data: cutoff };
  }

  @Patch(':id/status') @Roles('data_manager', 'super_admin') @RequirePermissions(PERMISSIONS.CUTOFFS_RESOLVE)
  async setStatus(@Param('id') id: string, @Body() dto: UpdateCutoffStatusDto, @Req() req: AdminReq) {
    const cutoff = await this.svc.setCutoffStatus(id, dto.status, req.user?.sub || 'admin');
    return { success: true, data: cutoff };
  }

  @Delete(':id') @Roles('data_manager', 'super_admin')
  async deleteCutoff(@Param('id') id: string, @Req() req: AdminReq) {
    const result = await this.svc.deleteCutoff(id, req.user?.sub || 'admin');
    return { success: true, data: result };
  }

  @Post('bulk-delete') @Roles('data_manager', 'super_admin')
  async bulkDelete(@Body('ids') ids: string[], @Req() req: AdminReq) {
    const result = await this.svc.bulkDeleteCutoffs(ids || [], req.user?.sub || 'admin');
    return { success: true, data: result };
  }
}
