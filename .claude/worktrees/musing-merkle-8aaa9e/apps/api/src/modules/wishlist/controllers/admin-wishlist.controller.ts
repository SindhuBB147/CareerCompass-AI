import { Controller, Get } from '@nestjs/common';
import { WishlistAnalyticsService } from '../services/wishlist-analytics.service';
import { Roles } from '../../../common/decorators/auth.decorators';

@Controller('admin/wishlist')
@Roles('data_manager', 'super_admin')
export class AdminWishlistController {
  constructor(private readonly analytics: WishlistAnalyticsService) {}

  @Get('analytics')
  async getAnalytics() {
    return { success: true, data: await this.analytics.getAnalytics() };
  }
}
