import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req,
} from '@nestjs/common';
import { Request } from 'express';
import { CareerCatalogService } from './services/career-catalog.service';
import { RoadmapGeneratorService } from './services/roadmap-generator.service';
import { RoadmapProgressService } from './services/roadmap-progress.service';
import { RoadmapRecommendationService } from './services/roadmap-recommendation.service';
import { RoadmapExportService } from './services/roadmap-export.service';
import {
  GenerateRoadmapDto, GetRoadmapQueryDto, ListCareersQueryDto, UpdateMilestoneDto,
} from './dto/roadmap.dto';
import { Public } from '../../common/decorators/auth.decorators';
import { AccessTokenPayload } from '../auth/services/token.service';

type AuthReq = Request & { user: AccessTokenPayload };

@Controller('career-roadmap')
export class RoadmapController {
  constructor(
    private readonly catalogService: CareerCatalogService,
    private readonly generatorService: RoadmapGeneratorService,
    private readonly progressService: RoadmapProgressService,
    private readonly recommendationService: RoadmapRecommendationService,
    private readonly exportService: RoadmapExportService,
  ) {}

  @Get('careers')
  async listCareers(@Query() q: ListCareersQueryDto) {
    return { success: true, data: await this.catalogService.listSummaries(q.category) };
  }

  @Get()
  async getRoadmap(@Query() q: GetRoadmapQueryDto, @Req() req: AuthReq) {
    const roadmap = await this.generatorService.getOrGenerate(req.user.sub, q.careerId);
    if (!roadmap) {
      return { success: true, data: null }; // no career resolved yet — frontend shows the career picker
    }
    return { success: true, data: roadmap };
  }

  @Post('generate')
  async generate(@Body() dto: GenerateRoadmapDto, @Req() req: AuthReq) {
    return { success: true, data: await this.generatorService.generate(req.user.sub, dto.careerId) };
  }

  @Patch('milestones/:milestoneKey')
  async updateMilestone(@Param('milestoneKey') milestoneKey: string, @Body() dto: UpdateMilestoneDto, @Req() req: AuthReq) {
    return { success: true, data: await this.progressService.updateMilestone(req.user.sub, milestoneKey, dto) };
  }

  @Get('analytics')
  async getAnalytics(@Req() req: AuthReq) {
    return { success: true, data: await this.progressService.getActiveAnalytics(req.user.sub) };
  }

  @Get('recommendations')
  async getRecommendations(@Req() req: AuthReq) {
    return { success: true, data: await this.recommendationService.getRecommendations(req.user.sub) };
  }

  @Post('share') @HttpCode(HttpStatus.OK)
  async enableShare(@Req() req: AuthReq) {
    return { success: true, data: await this.exportService.enableShare(req.user.sub) };
  }

  @Post('share/disable') @HttpCode(HttpStatus.OK)
  async disableShare(@Req() req: AuthReq) {
    await this.exportService.disableShare(req.user.sub);
    return { success: true, data: { shareEnabled: false } };
  }

  @Get('shared/:token') @Public()
  async getShared(@Param('token') token: string) {
    return { success: true, data: await this.exportService.getShared(token) };
  }
}
