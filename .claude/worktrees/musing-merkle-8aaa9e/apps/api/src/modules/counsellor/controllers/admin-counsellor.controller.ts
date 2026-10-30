import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CounsellorService } from '../services/counsellor.service';
import { AiServiceClient } from '../../../common/ai-client/ai-service.client';
import {
  CreatePromptTemplateDto, KnowledgeUploadQueryDto, ReindexDto, SetLlmProviderDto, UpdatePromptTemplateDto,
} from '../dto/counsellor.dto';
import { Roles } from '../../../common/decorators/auth.decorators';
import { DomainException } from '../../../common/filters/domain.exception';
import { HttpStatus } from '@nestjs/common';
import { AccessTokenPayload } from '../../auth/services/token.service';

type AdminReq = Request & { user: AccessTokenPayload };

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — mirrors ai-service's MAX_UPLOAD_MB

@Controller('admin/ai-counsellor')
export class AdminCounsellorController {
  constructor(
    private readonly svc: CounsellorService,
    private readonly aiServiceClient: AiServiceClient,
  ) {}

  @Get('flagged') @Roles('super_admin', 'data_manager', 'support_agent')
  async flagged() {
    return { success: true, data: { sessions: await this.svc.listFlaggedSessions() } };
  }

  @Get('usage') @Roles('super_admin', 'data_manager')
  async usage() {
    return { success: true, data: await this.svc.getUsageSummary() };
  }

  @Post('knowledge/upload') @Roles('super_admin', 'data_manager')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file'))
  async uploadKnowledge(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: KnowledgeUploadQueryDto,
    @Req() req: AdminReq,
  ) {
    if (!file) {
      throw new DomainException('VALIDATION_ERROR', 'A file is required.', HttpStatus.BAD_REQUEST);
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new DomainException('VALIDATION_ERROR', `Unsupported file type "${file.mimetype}". Allowed: PDF, TXT, DOCX.`, HttpStatus.BAD_REQUEST);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new DomainException('VALIDATION_ERROR', 'File exceeds the 10MB upload limit.', HttpStatus.BAD_REQUEST);
    }

    const result = await this.aiServiceClient.uploadKnowledge(
      file.buffer, file.originalname, file.mimetype,
      query.docType ?? 'brochure', query.title, req.user.sub,
    );
    return { success: true, data: result };
  }

  @Post('knowledge/reindex') @Roles('super_admin', 'data_manager')
  async reindex(@Query() dto: ReindexDto) {
    return { success: true, data: await this.aiServiceClient.reindex(dto.documentId) };
  }

  @Get('knowledge/status') @Roles('super_admin', 'data_manager', 'support_agent')
  async knowledgeStatus() {
    return { success: true, data: await this.aiServiceClient.knowledgeStatus() };
  }

  @Delete('knowledge/:documentId') @Roles('super_admin', 'data_manager')
  async deleteKnowledge(@Param('documentId') documentId: string) {
    await this.aiServiceClient.deleteKnowledgeDocument(documentId);
    return { success: true, data: { documentId, deleted: true } };
  }

  // ── Prompt templates ────────────────────────────────────────────────────────
  // Excludes support_agent, unlike the knowledge-status/flagged routes above —
  // editing the system prompt is a more sensitive lever than reviewing content.

  @Get('prompt-templates') @Roles('super_admin', 'data_manager')
  async listPromptTemplates() {
    return { success: true, data: await this.aiServiceClient.listPromptTemplates() };
  }

  @Post('prompt-templates') @Roles('super_admin', 'data_manager')
  async createPromptTemplate(@Body() dto: CreatePromptTemplateDto) {
    return { success: true, data: await this.aiServiceClient.createPromptTemplate(dto.name, dto.systemPrompt) };
  }

  @Patch('prompt-templates/:templateId') @Roles('super_admin', 'data_manager')
  async updatePromptTemplate(@Param('templateId') templateId: string, @Body() dto: UpdatePromptTemplateDto) {
    return { success: true, data: await this.aiServiceClient.updatePromptTemplate(templateId, dto.systemPrompt) };
  }

  @Post('prompt-templates/:templateId/activate') @Roles('super_admin', 'data_manager')
  async activatePromptTemplate(@Param('templateId') templateId: string) {
    return { success: true, data: await this.aiServiceClient.activatePromptTemplate(templateId) };
  }

  @Delete('prompt-templates/:templateId') @Roles('super_admin', 'data_manager')
  async deletePromptTemplate(@Param('templateId') templateId: string) {
    await this.aiServiceClient.deletePromptTemplate(templateId);
    return { success: true, data: { templateId, deleted: true } };
  }

  // ── Live LLM provider switch ────────────────────────────────────────────────
  // super_admin only — this changes which paid API gets billed and affects
  // every user's answers immediately, a stricter bar than the routes above.

  @Get('llm-provider') @Roles('super_admin')
  async getLlmProvider() {
    return { success: true, data: await this.aiServiceClient.getLlmProviderSettings() };
  }

  @Put('llm-provider') @Roles('super_admin')
  async setLlmProvider(@Body() dto: SetLlmProviderDto) {
    return { success: true, data: await this.aiServiceClient.setLlmProviderOverride(dto.provider) };
  }
}
