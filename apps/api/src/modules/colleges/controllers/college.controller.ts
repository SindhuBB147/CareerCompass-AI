import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { CollegeService } from '../services/college.service';
import { Public, Roles, RequireReauth } from '../../../common/decorators/auth.decorators';
import {
  CompareCollegesDto, CollegeFacetsQueryDto, CreateCollegeDto, CreateCourseDto, CreatePlacementDto, CreateReviewDto,
  SearchCollegesDto, UpdateCollegeDto, UpdateCourseDto, UpdateCourseFeeDto, UpdatePlacementDto,
} from '../dto/college.dto';
import { AccessTokenPayload } from '../../auth/services/token.service';

type AdminReq = Request & { user: AccessTokenPayload };

// ── Public Endpoints ───────────────────────────────────────────────────────────
@Controller('colleges')
export class CollegeController {
  constructor(private readonly service: CollegeService) {}

  @Get() @Public()
  async search(@Query() query: SearchCollegesDto) {
    return { success: true, data: await this.service.search(query) };
  }

  // Must be registered before ':id' — otherwise 'facets' is matched as an :id param.
  @Get('facets') @Public()
  async facets(@Query() query: CollegeFacetsQueryDto) {
    return { success: true, data: await this.service.getFacets(query.examCode) };
  }

  @Get(':id') @Public()
  async detail(@Param('id') id: string) {
    return { success: true, data: await this.service.getDetail(id) };
  }

  @Post('compare') @Public()
  async compare(@Body() dto: CompareCollegesDto) {
    return { success: true, data: { colleges: await this.service.compare(dto) } };
  }

  @Post(':id/reviews') @Public()
  async addReview(@Param('id') id: string, @Body() dto: CreateReviewDto) {
    return { success: true, data: await this.service.addReview(id, dto) };
  }
}

// ── Admin Endpoints — College Management ───────────────────────────────────────
@Controller('admin/colleges')
export class AdminCollegeController {
  constructor(private readonly service: CollegeService) {}

  @Post() @Roles('data_manager', 'super_admin')
  async create(@Body() dto: CreateCollegeDto, @Req() req: AdminReq, @Ip() ip: string) {
    return { success: true, data: await this.service.create(dto, req.user.sub, ip) };
  }

  @Patch(':id') @Roles('data_manager', 'super_admin')
  async update(@Param('id') id: string, @Body() dto: UpdateCollegeDto, @Req() req: AdminReq, @Ip() ip: string) {
    return { success: true, data: await this.service.update(id, dto, req.user.sub, ip) };
  }

  @Delete(':id') @Roles('data_manager', 'super_admin') @RequireReauth()
  async delete(@Param('id') id: string, @Req() req: AdminReq, @Ip() ip: string) {
    await this.service.delete(id, req.user.sub, ip);
    return { success: true, data: { deleted: true } };
  }

  // ── Branch (course) endpoints ────────────────────────────────────────────────
  @Post(':id/courses') @Roles('data_manager', 'super_admin')
  async addCourse(@Param('id') id: string, @Body() dto: CreateCourseDto) {
    return { success: true, data: await this.service.addCourse(id, dto) };
  }

  @Patch(':id/courses/:courseId') @Roles('data_manager', 'super_admin')
  async updateCourse(@Param('id') id: string, @Param('courseId') cid: string, @Body() dto: UpdateCourseDto) {
    return { success: true, data: await this.service.updateCourse(id, cid, dto) };
  }

  @Delete(':id/courses/:courseId') @Roles('data_manager', 'super_admin')
  async removeCourse(@Param('id') id: string, @Param('courseId') cid: string) {
    await this.service.removeCourse(id, cid);
    return { success: true, data: { deleted: true } };
  }

  // ── Fee management ───────────────────────────────────────────────────────────
  @Patch(':id/courses/:courseId/fee') @Roles('data_manager', 'super_admin')
  async updateFee(@Param('id') id: string, @Param('courseId') cid: string, @Body() dto: UpdateCourseFeeDto) {
    return { success: true, data: await this.service.updateCourseFee(id, cid, dto.feePerYear) };
  }

  // ── Placement endpoints ──────────────────────────────────────────────────────
  @Post(':id/placement') @Roles('data_manager', 'super_admin')
  async addPlacement(@Param('id') id: string, @Body() dto: CreatePlacementDto) {
    return { success: true, data: await this.service.addPlacement(id, dto) };
  }

  @Patch(':id/placement/:year') @Roles('data_manager', 'super_admin')
  async updatePlacement(@Param('id') id: string, @Param('year') year: string, @Body() dto: UpdatePlacementDto) {
    return { success: true, data: await this.service.updatePlacement(id, parseInt(year, 10), dto) };
  }
}
