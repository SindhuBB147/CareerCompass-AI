import { Controller, Get, Module, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { User, UserSchema } from '../users/models/user.model';
import { Prediction, PredictionSchema } from '../predictions/models/prediction.model';
import { Cutoff, CutoffSchema } from '../cutoffs/models/cutoff.model';
import { Notification, NotificationSchema } from '../notifications/models/notification.model';
import { ReportingService } from './services/reporting.service';
import { Roles } from '../../common/decorators/auth.decorators';

// ── DTOs ──────────────────────────────────────────────────────────────────────

class PlatformReportDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

class CohortReportDto {
  @IsString() examCode: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('admin/reports')
export class ReportingController {
  constructor(private readonly svc: ReportingService) {}

  @Get('platform') @Roles('super_admin', 'data_manager')
  async platform(@Query() q: PlatformReportDto) {
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = q.to ? new Date(q.to) : new Date();
    return { success: true, data: await this.svc.generatePlatformReport(from, to) };
  }

  @Get('cohort') @Roles('super_admin', 'data_manager', 'b2b_account_manager')
  async cohort(@Query() q: CohortReportDto) {
    return { success: true, data: await this.svc.generateCohortReport(q.examCode) };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Prediction.name, schema: PredictionSchema },
      { name: Cutoff.name, schema: CutoffSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [ReportingController],
  providers: [ReportingService],
})
export class ReportingModule {}
