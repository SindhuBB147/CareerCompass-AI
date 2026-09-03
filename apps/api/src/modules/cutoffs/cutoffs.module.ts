import { Body, Controller, Get, Module, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Request } from 'express';
import { CutoffService } from './cutoff.service';
import { BulkUploadDto, CutoffTrendQueryDto, ResolveConflictDto } from './cutoff.dto';
import { Exam, ExamSchema } from './models/exam.model';
import { Cutoff, CutoffConflict, CutoffConflictSchema, CutoffSchema } from './models/cutoff.model';
import { CollegesModule } from '../colleges/colleges.module';
import { Public, Roles } from '../../common/decorators/auth.decorators';
import { AccessTokenPayload } from '../auth/services/token.service';

type AdminReq = Request & { user: AccessTokenPayload };

@Controller('colleges/:collegeId/cutoffs')
export class CutoffController {
  constructor(private readonly svc: CutoffService) {}

  @Get() @Public()
  async trend(@Param('collegeId') cid: string, @Query() q: CutoffTrendQueryDto) {
    const trend = await this.svc.getTrend(cid, q.courseId, q.examCode, q.category, q.quota, q.year, q.round);
    return { success: true, data: { collegeId: cid, courseId: q.courseId, examCode: q.examCode, trend } };
  }
}

@Controller('cutoffs')
export class PublicCutoffController {
  constructor(private readonly svc: CutoffService) {}

  @Get('readiness') @Public()
  async getReadiness() {
    return { success: true, data: await this.svc.getReadinessReports() };
  }
}

@Controller('admin/cutoffs')
export class AdminCutoffController {
  constructor(private readonly svc: CutoffService) {}

  @Post('bulk-upload') @Roles('data_manager', 'super_admin')
  async bulkUpload(@Body() dto: BulkUploadDto) {
    return { success: true, data: await this.svc.bulkUpload(dto.rows) };
  }

  @Get('conflicts') @Roles('data_manager', 'super_admin')
  async listConflicts() {
    return { success: true, data: { conflicts: await this.svc.listOpenConflicts() } };
  }

  @Patch('conflicts/:id/resolve') @Roles('data_manager', 'super_admin')
  async resolve(@Param('id') id: string, @Body() dto: ResolveConflictDto, @Req() req: AdminReq) {
    await this.svc.resolveConflict(id, dto.resolvedValue, req.user.sub);
    return { success: true, data: { conflictId: id, status: 'resolved' } };
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: Cutoff.name, schema: CutoffSchema },
      { name: CutoffConflict.name, schema: CutoffConflictSchema },
    ]),
    CollegesModule,
  ],
  controllers: [CutoffController, PublicCutoffController, AdminCutoffController],
  providers: [CutoffService],
  exports: [CutoffService],
})
export class CutoffsModule {}
