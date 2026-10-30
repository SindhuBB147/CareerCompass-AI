import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CutoffService } from './cutoff.service';
import { CutoffPdfGeneratorService } from './cutoff-pdf-generator.service';
import { CutoffFileParserService } from './cutoff-file-parser.service';
import { CutoffController, GenericCutoffController, AdminCutoffController } from './cutoff.controller';
import { Exam, ExamSchema } from './models/exam.model';
import { Cutoff, CutoffConflict, CutoffConflictSchema, CutoffImportLog, CutoffImportLogSchema, CutoffSchema } from './models/cutoff.model';
import { CollegesModule } from '../colleges/colleges.module';
import { StudentReportsModule } from '../student-reports/student-reports.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: Cutoff.name, schema: CutoffSchema },
      { name: CutoffConflict.name, schema: CutoffConflictSchema },
      { name: CutoffImportLog.name, schema: CutoffImportLogSchema },
    ]),
    CollegesModule,
    StudentReportsModule,
  ],
  controllers: [CutoffController, GenericCutoffController, AdminCutoffController],
  providers: [CutoffService, CutoffPdfGeneratorService, CutoffFileParserService],
  exports: [CutoffService, CutoffPdfGeneratorService],
})
export class CutoffsModule {}
