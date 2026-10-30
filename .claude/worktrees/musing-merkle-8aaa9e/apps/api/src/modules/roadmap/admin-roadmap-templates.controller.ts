import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { CareerCatalogService } from './services/career-catalog.service';
import { CreateCareerTemplateDto, UpdateCareerTemplateDto } from './dto/admin-career-template.dto';
import { Roles } from '../../common/decorators/auth.decorators';

@Controller('admin/roadmap-templates')
@Roles('data_manager', 'super_admin')
export class AdminRoadmapTemplatesController {
  constructor(private readonly catalogService: CareerCatalogService) {}

  @Get()
  async list(@Query('page') page?: string, @Query('limit') limit?: string) {
    const result = await this.catalogService.listForAdmin(page ? Number(page) : 1, limit ? Number(limit) : 20);
    return { success: true, data: result };
  }

  @Get(':careerId')
  async detail(@Param('careerId') careerId: string) {
    return { success: true, data: await this.catalogService.getByCareerId(careerId) };
  }

  @Post()
  async create(@Body() dto: CreateCareerTemplateDto) {
    return { success: true, data: await this.catalogService.create(dto as any) };
  }

  @Patch(':careerId')
  async update(@Param('careerId') careerId: string, @Body() dto: UpdateCareerTemplateDto) {
    return { success: true, data: await this.catalogService.update(careerId, dto as any) };
  }

  @Delete(':careerId')
  async remove(@Param('careerId') careerId: string) {
    await this.catalogService.delete(careerId);
    return { success: true, data: { deleted: true } };
  }
}
