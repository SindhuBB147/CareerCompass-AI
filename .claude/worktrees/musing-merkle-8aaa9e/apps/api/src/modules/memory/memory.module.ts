import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConsentRecord, ConsentRecordSchema } from './models/consent-record.model';
import { UserSessionState, UserSessionStateSchema } from './models/user-session-state.model';
import { ConsentService } from './services/consent.service';
import { SessionStateService } from './services/session-state.service';
import { MemoryAggregatorService } from './services/memory-aggregator.service';
import { MemoryController } from './controllers/memory.controller';
import { ConsentController } from './controllers/consent.controller';
import { SessionStateController } from './controllers/session-state.controller';
import { UsersModule } from '../users/users.module';
import { WishlistModule } from '../wishlist/wishlist.module';
import { SearchModule } from '../search/search.module';
import { CounsellorModule } from '../counsellor/counsellor.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { FinancialPlanningModule } from '../financial-planning/financial-planning.module';
import { ScholarshipsModule } from '../scholarships/scholarships.module';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Cross-cutting Memory & Session Persistence facade — owns only consent and
 * UI session-state (nowhere else to live). Every other memory category is
 * read from (and deleted through) the module that already owns it via
 * MemoryAggregatorService, so this module never duplicates a store.
 * Read-only imports of every feature module that owns a memory category —
 * none of those modules import this one back, so there's no cycle.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConsentRecord.name, schema: ConsentRecordSchema },
      { name: UserSessionState.name, schema: UserSessionStateSchema },
    ]),
    UsersModule,
    WishlistModule,
    SearchModule,
    CounsellorModule,
    PredictionsModule,
    FinancialPlanningModule,
    ScholarshipsModule,
    RoadmapModule,
    NotificationsModule,
  ],
  controllers: [MemoryController, ConsentController, SessionStateController],
  providers: [ConsentService, SessionStateService, MemoryAggregatorService],
  exports: [ConsentService, SessionStateService, MemoryAggregatorService],
})
export class MemoryModule {}
