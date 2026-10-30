import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiConversation, AiConversationSchema } from './models/ai-conversation.model';
import { AiUsageLog, AiUsageLogSchema } from './models/ai-usage-log.model';
import { AiFeedback, AiFeedbackSchema } from './models/ai-feedback.model';
import { UserAiMemory, UserAiMemorySchema } from './models/user-ai-memory.model';
import { CounsellorController } from './controllers/counsellor.controller';
import { AdminCounsellorController } from './controllers/admin-counsellor.controller';
import { CounsellorService } from './services/counsellor.service';
import { ContextAggregatorService } from './services/context-aggregator.service';
import { ConversationMemoryService } from './services/conversation-memory.service';
import { AiClientModule } from '../../common/ai-client/ai-client.module';
import { UsersModule } from '../users/users.module';
import { CollegesModule } from '../colleges/colleges.module';
import { CutoffsModule } from '../cutoffs/cutoffs.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { ScholarshipsModule } from '../scholarships/scholarships.module';
import { FinancialPlanningModule } from '../financial-planning/financial-planning.module';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentReportsModule } from '../student-reports/student-reports.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiConversation.name, schema: AiConversationSchema },
      { name: AiUsageLog.name, schema: AiUsageLogSchema },
      { name: AiFeedback.name, schema: AiFeedbackSchema },
      { name: UserAiMemory.name, schema: UserAiMemorySchema },
    ]),
    AiClientModule,
    UsersModule,
    CollegesModule,
    CutoffsModule,
    PredictionsModule,
    ScholarshipsModule,
    FinancialPlanningModule,
    RoadmapModule,
    NotificationsModule,
    StudentReportsModule,
  ],
  controllers: [CounsellorController, AdminCounsellorController],
  providers: [CounsellorService, ContextAggregatorService, ConversationMemoryService],
  exports: [CounsellorService, ConversationMemoryService],
})
export class CounsellorModule {}
