import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GeneratedReport, GeneratedReportSchema } from './models/report.model';
import { Prediction, PredictionSchema } from '../predictions/models/prediction.model';
import { ReportRepository } from './repositories/report.repository';
import { ReportDataAggregatorService } from './services/report-data-aggregator.service';
import { ReportFileStorageService } from './services/report-file-storage.service';
import { PdfRendererService } from './services/pdf-renderer.service';
import { ExcelRendererService } from './services/excel-renderer.service';
import { CsvRendererService } from './services/csv-renderer.service';
import { HtmlTemplateService } from './services/html-template.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { ReportShareService } from './services/report-share.service';
import { ReportEmailService } from './services/report-email.service';
import { StudentReportsController } from './student-reports.controller';
import { UsersModule } from '../users/users.module';
import { CollegesModule } from '../colleges/colleges.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { FinancialPlanningModule } from '../financial-planning/financial-planning.module';
import { ScholarshipsModule } from '../scholarships/scholarships.module';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { WishlistModule } from '../wishlist/wishlist.module';
import { MailerModule } from '../../common/mailer/mailer.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GeneratedReport.name, schema: GeneratedReportSchema },
      // Read-only direct access to collegeId/courseId per prediction —
      // same precedent WishlistEnrichmentService uses (see wishlist.module.ts).
      { name: Prediction.name, schema: PredictionSchema },
    ]),
    UsersModule, CollegesModule, PredictionsModule, FinancialPlanningModule,
    ScholarshipsModule, RoadmapModule, WishlistModule, MailerModule,
  ],
  controllers: [StudentReportsController],
  providers: [
    ReportRepository, ReportDataAggregatorService, ReportFileStorageService,
    PdfRendererService, ExcelRendererService, CsvRendererService, HtmlTemplateService,
    ReportGeneratorService, ReportShareService, ReportEmailService,
  ],
  exports: [ReportGeneratorService],
})
export class StudentReportsModule {}
