import { Controller, Get, Module, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IsDateString, IsOptional } from 'class-validator';
import { User, UserSchema } from '../users/models/user.model';
import { AiConversation, AiConversationSchema } from '../counsellor/models/ai-conversation.model';
import { AiUsageLog, AiUsageLogSchema } from '../counsellor/models/ai-usage-log.model';
import { Prediction, PredictionSchema } from '../predictions/models/prediction.model';
import { College, CollegeSchema } from '../colleges/models/college.model';
import { CutoffConflict, CutoffConflictSchema } from '../cutoffs/models/cutoff.model';
import { Scholarship, ScholarshipSchema } from '../scholarships/models/scholarship.model';
import { SearchHistory, SearchHistorySchema } from '../search/models/search-history.model';
import { UserAiMemory, UserAiMemorySchema } from '../counsellor/models/user-ai-memory.model';
import { AnalyticsService } from './services/analytics.service';
import { Roles } from '../../common/decorators/auth.decorators';
import { CollegesModule } from '../colleges/colleges.module';

// ── DTO ───────────────────────────────────────────────────────────────────────

export class DashboardQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('dashboard') @Roles('super_admin', 'data_manager')
  async dashboard(@Query() q: DashboardQueryDto) {
    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;
    return { success: true, data: await this.svc.getDashboardMetrics(from, to) };
  }

  /** Anonymized only — see AnalyticsService.getMemoryAnalytics() for the privacy rationale. */
  @Get('memory-usage') @Roles('super_admin', 'data_manager')
  async memoryUsage() {
    return { success: true, data: await this.svc.getMemoryAnalytics() };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AiConversation.name, schema: AiConversationSchema },
      { name: AiUsageLog.name, schema: AiUsageLogSchema },
      { name: Prediction.name, schema: PredictionSchema },
      { name: College.name, schema: CollegeSchema },
      { name: CutoffConflict.name, schema: CutoffConflictSchema },
      { name: Scholarship.name, schema: ScholarshipSchema },
      { name: SearchHistory.name, schema: SearchHistorySchema },
      { name: UserAiMemory.name, schema: UserAiMemorySchema },
    ]),
    CollegesModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
