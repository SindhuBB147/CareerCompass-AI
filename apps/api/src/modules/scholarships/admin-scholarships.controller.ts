import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ScholarshipService } from './services/scholarship.service';
import { AdminListScholarshipsDto, CreateScholarshipDto, UpdateScholarshipDto } from './dto/scholarship.dto';
import { Roles } from '../../common/decorators/auth.decorators';

@Controller('admin/scholarships')
export class AdminScholarshipController {
  constructor(private readonly svc: ScholarshipService) {}

  @Get() @Roles('data_manager', 'super_admin')
  async list(@Query() q: AdminListScholarshipsDto) {
    const result = await this.svc.listForAdmin(q, q.page ?? 1, q.limit ?? 20);
    return { success: true, data: result };
  }

  @Get(':id') @Roles('data_manager', 'super_admin')
  async detail(@Param('id') id: string) {
    return { success: true, data: await this.svc.getDetail(id) };
  }

  @Post() @Roles('data_manager', 'super_admin')
  async create(@Body() dto: CreateScholarshipDto) {
    return { success: true, data: await this.svc.create(dto) };
  }

  @Patch(':id') @Roles('data_manager', 'super_admin')
  async update(@Param('id') id: string, @Body() dto: UpdateScholarshipDto) {
    return { success: true, data: await this.svc.update(id, dto) };
  }

  @Delete(':id') @Roles('data_manager', 'super_admin')
  async remove(@Param('id') id: string) {
    await this.svc.delete(id);
    return { success: true, data: { deleted: true } };
  }

  @Post(':id/notify-deadline') @HttpCode(HttpStatus.OK) @Roles('data_manager', 'super_admin')
  async notifyDeadline(@Param('id') id: string) {
    const notified = await this.svc.notifyDeadlineApproaching(id);
    return { success: true, data: { notified } };
  }
}
