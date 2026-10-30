import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ScholarshipTaxonomyService } from './services/scholarship-taxonomy.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProviderDto, UpdateProviderDto } from './dto/provider.dto';
import { Roles } from '../../common/decorators/auth.decorators';

@Controller('admin/scholarship-categories')
export class AdminScholarshipCategoryController {
  constructor(private readonly svc: ScholarshipTaxonomyService) {}

  @Get() @Roles('data_manager', 'super_admin')
  async list() {
    return { success: true, data: await this.svc.listCategories() };
  }

  @Post() @Roles('data_manager', 'super_admin')
  async create(@Body() dto: CreateCategoryDto) {
    return { success: true, data: await this.svc.createCategory(dto) };
  }

  @Patch(':id') @Roles('data_manager', 'super_admin')
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return { success: true, data: await this.svc.updateCategory(id, dto) };
  }

  @Delete(':id') @Roles('data_manager', 'super_admin')
  async remove(@Param('id') id: string) {
    await this.svc.deleteCategory(id);
    return { success: true, data: { deleted: true } };
  }
}

@Controller('admin/scholarship-providers')
export class AdminScholarshipProviderController {
  constructor(private readonly svc: ScholarshipTaxonomyService) {}

  @Get() @Roles('data_manager', 'super_admin')
  async list() {
    return { success: true, data: await this.svc.listProviders() };
  }

  @Post() @Roles('data_manager', 'super_admin')
  async create(@Body() dto: CreateProviderDto) {
    return { success: true, data: await this.svc.createProvider(dto) };
  }

  @Patch(':id') @Roles('data_manager', 'super_admin')
  async update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return { success: true, data: await this.svc.updateProvider(id, dto) };
  }

  @Delete(':id') @Roles('data_manager', 'super_admin')
  async remove(@Param('id') id: string) {
    await this.svc.deleteProvider(id);
    return { success: true, data: { deleted: true } };
  }
}
