import { Controller, Get, Delete, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { WishlistAnalyticsService } from '../services/wishlist-analytics.service';
import { Roles, RequirePermissions } from '../../../common/decorators/auth.decorators';
import { PERMISSIONS } from '../../../common/permissions';
import { AccessTokenPayload } from '../../auth/services/token.service';

type AdminRequest = Request & { user: AccessTokenPayload };

@Controller('admin/wishlist')
@Roles('data_manager', 'super_admin')
export class AdminWishlistController {
  constructor(private readonly analytics: WishlistAnalyticsService) {}

  @Get('analytics')
  async getAnalytics() {
    return { success: true, data: await this.analytics.getAnalytics() };
  }

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('state') state?: string,
    @Query('district') district?: string,
    @Query('collegeType') collegeType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(200, Number(limit) || 20));
    const { rows, total } = await this.analytics.listSavedColleges({
      q, status, state, district, collegeType, dateFrom, dateTo,
      sortBy: sortBy as any,
      page: pageNum,
      limit: limitNum,
    });
    return {
      success: true,
      data: {
        records: rows,
        totalResults: total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  @Delete(':userId/:collegeId')
  @RequirePermissions(PERMISSIONS.WISHLIST_MANAGE)
  async remove(@Param('userId') userId: string, @Param('collegeId') collegeId: string, @Req() req: AdminRequest) {
    await this.analytics.removeSavedCollege(userId, collegeId, req.user.sub);
    return { success: true, userId, collegeId };
  }
}
