import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { ScholarshipService } from './services/scholarship.service';
import { ScholarshipTaxonomyService } from './services/scholarship-taxonomy.service';
import { ScholarshipInteractionService } from './services/scholarship-interaction.service';
import { ListScholarshipsDto } from './dto/scholarship.dto';
import { Public } from '../../common/decorators/auth.decorators';
import { AccessTokenPayload } from '../auth/services/token.service';

type AuthReq = Request & { user: AccessTokenPayload };

@Controller('scholarships')
export class ScholarshipController {
  constructor(
    private readonly svc: ScholarshipService,
    private readonly taxonomy: ScholarshipTaxonomyService,
    private readonly interactions: ScholarshipInteractionService,
  ) {}

  // ── Static/fixed-segment routes MUST be declared before ':id' — Nest
  // matches routes in declaration order, so ':id' would otherwise shadow
  // paths like 'categories' or 'featured'. ──────────────────────────────

  @Get('categories') @Public()
  async categories() {
    return { success: true, data: await this.taxonomy.listCategories() };
  }

  @Get('providers') @Public()
  async providers() {
    return { success: true, data: await this.taxonomy.listProviders() };
  }

  @Get('featured') @Public()
  async featured(@Query('limit') limit?: number) {
    return { success: true, data: await this.svc.listFeatured(limit ? Number(limit) : undefined) };
  }

  @Get('recommended')
  async recommended(@Req() req: AuthReq, @Query('limit') limit?: number) {
    const recommendations = await this.svc.getRecommended(req.user.sub, limit ? Number(limit) : undefined);
    return { success: true, data: { recommendations } };
  }

  @Get('matched')
  async matched(@Req() req: AuthReq) {
    return { success: true, data: { matches: await this.svc.getMatched(req.user.sub) } };
  }

  @Get('bookmarks')
  async bookmarks(@Req() req: AuthReq) {
    return { success: true, data: { scholarships: await this.svc.listBookmarks(req.user.sub) } };
  }

  @Post(':id/bookmark') @HttpCode(HttpStatus.OK)
  async addBookmark(@Param('id') id: string, @Req() req: AuthReq) {
    await this.svc.addBookmark(req.user.sub, id);
    return { success: true, data: { bookmarked: true } };
  }

  @Delete(':id/bookmark') @HttpCode(HttpStatus.OK)
  async removeBookmark(@Param('id') id: string, @Req() req: AuthReq) {
    await this.svc.removeBookmark(req.user.sub, id);
    return { success: true, data: { bookmarked: false } };
  }

  @Get(':id/eligibility')
  async eligibility(@Param('id') id: string, @Req() req: AuthReq) {
    return { success: true, data: await this.svc.checkEligibility(req.user.sub, id) };
  }

  // ── Scholarship Memory: interaction history (viewed/applied/rejected) ──
  // Bookmarks (saved) stay owned by ScholarshipBookmark above — this only
  // covers the interactions nothing else already tracks. Self-reported,
  // since the platform has no external application-tracking integration.

  @Get('interactions')
  async listInteractions(@Req() req: AuthReq) {
    return { success: true, data: await this.interactions.listForUser(req.user.sub) };
  }

  @Post(':id/interactions/view') @HttpCode(HttpStatus.OK)
  async recordView(@Param('id') id: string, @Req() req: AuthReq) {
    await this.interactions.record(req.user.sub, id, 'viewed');
    return { success: true, data: { recorded: true } };
  }

  @Post(':id/interactions/apply') @HttpCode(HttpStatus.OK)
  async markApplied(@Param('id') id: string, @Req() req: AuthReq) {
    await this.interactions.record(req.user.sub, id, 'applied');
    return { success: true, data: { recorded: true } };
  }

  @Post(':id/interactions/reject') @HttpCode(HttpStatus.OK)
  async markRejected(@Param('id') id: string, @Req() req: AuthReq) {
    await this.interactions.record(req.user.sub, id, 'rejected');
    return { success: true, data: { recorded: true } };
  }

  // ── General browse/search — must come before the plain ':id' route too,
  // since it lives at the controller root. ──────────────────────────────

  @Get() @Public()
  async list(@Query() q: ListScholarshipsDto) {
    const result = await this.svc.search(q, q.page ?? 1, q.limit ?? 12);
    return { success: true, data: result };
  }

  @Get(':id') @Public()
  async detail(@Param('id') id: string) {
    return { success: true, data: await this.svc.getDetail(id) };
  }
}
