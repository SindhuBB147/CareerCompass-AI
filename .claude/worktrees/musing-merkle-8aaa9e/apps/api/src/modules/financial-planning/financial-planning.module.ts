import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinancialPlanningController } from './financial-planning.controller';
import { FinancialPlanningService } from './financial-planning.service';
import { LoanService } from './services/loan.service';
import { FeeBreakdownService } from './services/fee-breakdown.service';
import { HostelLivingService } from './services/hostel-living.service';
import { ScholarshipSavingsService } from './services/scholarship-savings.service';
import { FinancialDashboardService } from './services/financial-dashboard.service';
import { FinancialPlanScenarioService } from './services/financial-plan-scenario.service';
import { FinancialPlanScenario, FinancialPlanScenarioSchema } from './models/financial-plan-scenario.model';
import { CollegesModule } from '../colleges/colleges.module';
import { ScholarshipsModule } from '../scholarships/scholarships.module';
import { PredictionsModule } from '../predictions/predictions.module';

@Module({
  imports: [
    CollegesModule, ScholarshipsModule, PredictionsModule,
    MongooseModule.forFeature([{ name: FinancialPlanScenario.name, schema: FinancialPlanScenarioSchema }]),
  ],
  controllers: [FinancialPlanningController],
  providers: [
    FinancialPlanningService, LoanService, FeeBreakdownService, HostelLivingService,
    ScholarshipSavingsService, FinancialDashboardService, FinancialPlanScenarioService,
  ],
  exports: [
    FinancialPlanningService, LoanService, FeeBreakdownService, HostelLivingService,
    ScholarshipSavingsService, FinancialDashboardService, FinancialPlanScenarioService,
  ],
})
export class FinancialPlanningModule {}
