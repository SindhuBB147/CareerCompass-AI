import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { WishlistService } from '../services/wishlist.service';
import { RecentlyViewedService } from '../services/recently-viewed.service';
import { WishlistComparisonService } from '../services/wishlist-comparison.service';
import { WishlistInsightsService } from '../services/wishlist-insights.service';
import { WishlistAdmissionTrackingService } from '../services/wishlist-admission-tracking.service';
import { WishlistShareService } from '../services/wishlist-share.service';
import {
  AddNoteDto, CompareSavedDto, CreateListDto, CreateShareDto, ListWishlistQueryDto,
  MoveCollegeDto, RenameListDto, SaveCollegeDto, SetStatusDto,
} from '../dto/wishlist.dto';
import { Public } from '../../../common/decorators/auth.decorators';
import { AccessTokenPayload } from '../../auth/services/token.service';

type AuthReq = Request & { user: AccessTokenPayload };

@Controller('wishlist')
export class WishlistController {
  constructor(
    private readonly wishlist: WishlistService,
    private readonly recentlyViewed: RecentlyViewedService,
    private readonly comparison: WishlistComparisonService,
    private readonly insights: WishlistInsightsService,
    private readonly admissionTracking: WishlistAdmissionTrackingService,
    private readonly share: WishlistShareService,
  ) {}

  // ── Full wishlist read ───────────────────────────────────────────────────────
  @Get()
  async getWishlist(@Query() query: ListWishlistQueryDto, @Req() req: AuthReq) {
    return { success: true, data: await this.wishlist.getWishlist(req.user.sub, query) };
  }

  // ── Lists ─────────────────────────────────────────────────────────────────────
  @Get('lists')
  async getLists(@Req() req: AuthReq) {
    return { success: true, data: { lists: await this.wishlist.getLists(req.user.sub) } };
  }

  @Post('lists')
  async createList(@Body() dto: CreateListDto, @Req() req: AuthReq) {
    return { success: true, data: await this.wishlist.createList(req.user.sub, dto.name, dto.icon) };
  }

  @Patch('lists/:id')
  async renameList(@Param('id') id: string, @Body() dto: RenameListDto, @Req() req: AuthReq) {
    return { success: true, data: await this.wishlist.renameList(req.user.sub, id, dto.name) };
  }

  @Delete('lists/:id') @HttpCode(HttpStatus.OK)
  async deleteList(@Param('id') id: string, @Req() req: AuthReq) {
    await this.wishlist.deleteList(req.user.sub, id);
    return { success: true, data: { deleted: true } };
  }

  @Post('lists/:id/duplicate')
  async duplicateList(@Param('id') id: string, @Req() req: AuthReq) {
    return { success: true, data: await this.wishlist.duplicateList(req.user.sub, id) };
  }

  @Post('lists/:id/colleges/:collegeId') @HttpCode(HttpStatus.OK)
  async addToList(@Param('id') listId: string, @Param('collegeId') collegeId: string, @Req() req: AuthReq) {
    await this.wishlist.addToList(req.user.sub, listId, collegeId);
    return { success: true, data: { added: true } };
  }

  @Delete('lists/:id/colleges/:collegeId') @HttpCode(HttpStatus.OK)
  async removeFromList(@Param('id') listId: string, @Param('collegeId') collegeId: string, @Req() req: AuthReq) {
    await this.wishlist.removeFromList(req.user.sub, listId, collegeId);
    return { success: true, data: { removed: true } };
  }

  // ── Save / remove / status / notes ───────────────────────────────────────────
  @Get('colleges/:id')
  async getSavedStatus(@Param('id') id: string, @Req() req: AuthReq) {
    return { success: true, data: await this.wishlist.getSavedStatus(req.user.sub, id) };
  }

  @Post('colleges/:id') @HttpCode(HttpStatus.OK)
  async save(@Param('id') id: string, @Body() dto: SaveCollegeDto, @Req() req: AuthReq) {
    await this.wishlist.saveCollege(req.user.sub, id, dto);
    return { success: true, data: { saved: true } };
  }

  @Delete('colleges/:id') @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Req() req: AuthReq) {
    await this.wishlist.removeCollege(req.user.sub, id);
    return { success: true, data: { saved: false } };
  }

  @Patch('colleges/:id/status')
  async setStatus(@Param('id') id: string, @Body() dto: SetStatusDto, @Req() req: AuthReq) {
    await this.wishlist.setStatus(req.user.sub, id, dto.status);
    return { success: true, data: { status: dto.status } };
  }

  @Post('colleges/:id/move') @HttpCode(HttpStatus.OK)
  async move(@Param('id') id: string, @Body() dto: MoveCollegeDto, @Req() req: AuthReq) {
    await this.wishlist.moveCollege(req.user.sub, id, dto.fromListId, dto.toListId);
    return { success: true, data: { moved: true } };
  }

  @Post('colleges/:id/notes')
  async addNote(@Param('id') id: string, @Body() dto: AddNoteDto, @Req() req: AuthReq) {
    return { success: true, data: await this.wishlist.addNote(req.user.sub, id, dto.text) };
  }

  @Delete('colleges/:id/notes/:noteId') @HttpCode(HttpStatus.OK)
  async removeNote(@Param('id') id: string, @Param('noteId') noteId: string, @Req() req: AuthReq) {
    await this.wishlist.removeNote(req.user.sub, id, noteId);
    return { success: true, data: { removed: true } };
  }

  @Get('colleges/:id/admission-tracking')
  async admissionTrackingFor(@Param('id') id: string, @Req() req: AuthReq) {
    return { success: true, data: await this.admissionTracking.getTracking(req.user.sub, id) };
  }

  // ── Recently viewed ───────────────────────────────────────────────────────────
  @Get('recently-viewed')
  async getRecentlyViewed(@Req() req: AuthReq) {
    return { success: true, data: { items: await this.recentlyViewed.list(req.user.sub) } };
  }

  @Post('recently-viewed/:collegeId') @HttpCode(HttpStatus.OK)
  async recordView(@Param('collegeId') collegeId: string, @Req() req: AuthReq) {
    await this.recentlyViewed.record(req.user.sub, collegeId);
    return { success: true, data: { recorded: true } };
  }

  @Delete('recently-viewed') @HttpCode(HttpStatus.OK)
  async clearRecentlyViewed(@Req() req: AuthReq) {
    await this.recentlyViewed.clear(req.user.sub);
    return { success: true, data: { cleared: true } };
  }

  // ── Compare ───────────────────────────────────────────────────────────────────
  @Post('compare')
  async compare(@Body() dto: CompareSavedDto, @Req() req: AuthReq) {
    return { success: true, data: { colleges: await this.comparison.compare(req.user.sub, dto.collegeIds, dto.name) } };
  }

  @Get('compare/history')
  async compareHistory(@Req() req: AuthReq) {
    return { success: true, data: { history: await this.comparison.listHistory(req.user.sub) } };
  }

  // ── AI Insights ───────────────────────────────────────────────────────────────
  @Get('insights')
  async getInsights(@Req() req: AuthReq) {
    return { success: true, data: await this.insights.getInsights(req.user.sub) };
  }

  // ── Share ─────────────────────────────────────────────────────────────────────
  @Post('share')
  async createShare(@Body() dto: CreateShareDto, @Req() req: AuthReq) {
    return { success: true, data: await this.share.createShare(req.user.sub, dto) };
  }

  @Get('shared/:token') @Public()
  async getShared(@Param('token') token: string) {
    return { success: true, data: await this.share.resolve(token) };
  }
}
