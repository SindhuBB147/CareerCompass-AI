import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchHistory, SearchHistorySchema } from './models/search-history.model';
import { SearchController } from './controllers/search.controller';
import { AdminSearchController } from './controllers/admin-search.controller';
import { SearchService } from './services/search.service';
import { SearchAggregatorService } from './services/search-aggregator.service';
import { CollegeRankingService } from './services/college-ranking.service';
import { SearchHistoryService } from './services/search-history.service';
import { AiClientModule } from '../../common/ai-client/ai-client.module';
import { UsersModule } from '../users/users.module';
import { CollegesModule } from '../colleges/colleges.module';
import { ScholarshipsModule } from '../scholarships/scholarships.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { FinancialPlanningModule } from '../financial-planning/financial-planning.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SearchHistory.name, schema: SearchHistorySchema }]),
    AiClientModule,
    UsersModule,
    CollegesModule,
    ScholarshipsModule,
    PredictionsModule,
    FinancialPlanningModule,
  ],
  controllers: [SearchController, AdminSearchController],
  providers: [SearchService, SearchAggregatorService, CollegeRankingService, SearchHistoryService],
  exports: [SearchService, SearchHistoryService],
})
export class SearchModule {}
