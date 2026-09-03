import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SavedCollege, SavedCollegeSchema } from './models/saved-college.model';
import { WishlistList, WishlistListSchema } from './models/wishlist-list.model';
import { WishlistListItem, WishlistListItemSchema } from './models/wishlist-list-item.model';
import { RecentlyViewedCollege, RecentlyViewedCollegeSchema } from './models/recently-viewed-college.model';
import { ComparisonSnapshot, ComparisonSnapshotSchema } from './models/comparison-snapshot.model';
import { WishlistShare, WishlistShareSchema } from './models/wishlist-share.model';
import { Prediction, PredictionSchema } from '../predictions/models/prediction.model';

import { SavedCollegeRepository } from './repositories/saved-college.repository';
import { WishlistListRepository } from './repositories/wishlist-list.repository';
import { WishlistListItemRepository } from './repositories/wishlist-list-item.repository';
import { RecentlyViewedRepository } from './repositories/recently-viewed.repository';
import { ComparisonSnapshotRepository } from './repositories/comparison-snapshot.repository';
import { WishlistShareRepository } from './repositories/wishlist-share.repository';

import { WishlistEnrichmentService } from './services/wishlist-enrichment.service';
import { WishlistService } from './services/wishlist.service';
import { RecentlyViewedService } from './services/recently-viewed.service';
import { WishlistComparisonService } from './services/wishlist-comparison.service';
import { WishlistInsightsService } from './services/wishlist-insights.service';
import { WishlistAdmissionTrackingService } from './services/wishlist-admission-tracking.service';
import { WishlistShareService } from './services/wishlist-share.service';
import { WishlistAnalyticsService } from './services/wishlist-analytics.service';

import { WishlistController } from './controllers/wishlist.controller';
import { AdminWishlistController } from './controllers/admin-wishlist.controller';

import { CollegesModule } from '../colleges/colleges.module';
import { ScholarshipsModule } from '../scholarships/scholarships.module';
import { CutoffsModule } from '../cutoffs/cutoffs.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SavedCollege.name, schema: SavedCollegeSchema },
      { name: WishlistList.name, schema: WishlistListSchema },
      { name: WishlistListItem.name, schema: WishlistListItemSchema },
      { name: RecentlyViewedCollege.name, schema: RecentlyViewedCollegeSchema },
      { name: ComparisonSnapshot.name, schema: ComparisonSnapshotSchema },
      { name: WishlistShare.name, schema: WishlistShareSchema },
      // Read-only: predictions already computed by PredictionsModule are
      // reused for enrichment (admission probability / ROI) without
      // recomputing — importing the schema directly (not PredictionsModule)
      // avoids a module cycle, same pattern NotificationsModule uses for
      // cross-module read access (see notifications.module.ts).
      { name: Prediction.name, schema: PredictionSchema },
    ]),
    CollegesModule,
    ScholarshipsModule,
    CutoffsModule,
    UsersModule,
  ],
  controllers: [WishlistController, AdminWishlistController],
  providers: [
    SavedCollegeRepository, WishlistListRepository, WishlistListItemRepository,
    RecentlyViewedRepository, ComparisonSnapshotRepository, WishlistShareRepository,
    WishlistEnrichmentService, WishlistService, RecentlyViewedService, WishlistComparisonService,
    WishlistInsightsService, WishlistAdmissionTrackingService, WishlistShareService, WishlistAnalyticsService,
  ],
  exports: [SavedCollegeRepository, WishlistService, RecentlyViewedService],
})
export class WishlistModule {}
