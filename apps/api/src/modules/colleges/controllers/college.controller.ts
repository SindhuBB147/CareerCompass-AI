import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { CollegeService } from '../services/college.service';
import { Public, Roles, RequireReauth } from '../../../common/decorators/auth.decorators';
import {
  AddGalleryImageDto, CompareCollegesDto, CollegeFacetsQueryDto, CreateCollegeDto, CreateCourseDto, CreatePlacementDto, CreateReviewDto,
  ReorderGalleryDto, SearchCollegesDto, UpdateCollegeDto, UpdateCourseDto, UpdateCourseFeeDto, UpdateGalleryImageDto, UpdatePlacementDto,
  UpdateSeatMatrixDto,
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
    return { success: true, data: { archived: true } };
  }

  @Post(':id/restore') @Roles('data_manager', 'super_admin')
  async restore(@Param('id') id: string, @Req() req: AdminReq, @Ip() ip: string) {
    return { success: true, data: await this.service.restore(id, req.user.sub, ip) };
  }

  // ── Branch (course) endpoints ────────────────────────────────────────────────
  @Post(':id/courses') @Roles('data_manager', 'super_admin')
  async addCourse(@Param('id') id: string, @Body() dto: CreateCourseDto, @Req() req: AdminReq) {
    return { success: true, data: await this.service.addCourse(id, dto, req.user.sub) };
  }

  @Patch(':id/courses/:courseId') @Roles('data_manager', 'super_admin')
  async updateCourse(@Param('id') id: string, @Param('courseId') cid: string, @Body() dto: UpdateCourseDto, @Req() req: AdminReq) {
    return { success: true, data: await this.service.updateCourse(id, cid, dto, req.user.sub) };
  }

  @Delete(':id/courses/:courseId') @Roles('data_manager', 'super_admin')
  async removeCourse(@Param('id') id: string, @Param('courseId') cid: string, @Req() req: AdminReq) {
    await this.service.removeCourse(id, cid, req.user.sub);
    return { success: true, data: { deleted: true } };
  }

  // ── Fee management ───────────────────────────────────────────────────────────
  @Patch(':id/courses/:courseId/fee') @Roles('data_manager', 'super_admin')
  async updateFee(@Param('id') id: string, @Param('courseId') cid: string, @Body() dto: UpdateCourseFeeDto, @Req() req: AdminReq) {
    return { success: true, data: await this.service.updateCourseFee(id, cid, dto.feePerYear, req.user.sub) };
  }

  // ── Seat matrix management ───────────────────────────────────────────────────
  @Patch(':id/courses/:courseId/seat-matrix') @Roles('data_manager', 'super_admin')
  async updateSeatMatrix(@Param('id') id: string, @Param('courseId') cid: string, @Body() dto: UpdateSeatMatrixDto, @Req() req: AdminReq) {
    return { success: true, data: await this.service.updateSeatMatrix(id, cid, dto, req.user.sub) };
  }

  // ── Placement endpoints ──────────────────────────────────────────────────────
  @Post(':id/placement') @Roles('data_manager', 'super_admin')
  async addPlacement(@Param('id') id: string, @Body() dto: CreatePlacementDto, @Req() req: AdminReq) {
    return { success: true, data: await this.service.addPlacement(id, dto, req.user.sub) };
  }

  @Patch(':id/placement/:year') @Roles('data_manager', 'super_admin')
  async updatePlacement(@Param('id') id: string, @Param('year') year: string, @Body() dto: UpdatePlacementDto, @Req() req: AdminReq) {
    return { success: true, data: await this.service.updatePlacement(id, parseInt(year, 10), dto, req.user.sub) };
  }

  // ── Nursing Seat Matrix Import ───────────────────────────────────────────────
  @Post('import/nursing-seats') @Roles('data_manager', 'super_admin')
  async importNursingSeats() {
    return { success: true, data: await this.service.importNursingSeats() };
  }

  // ── Images / Gallery ─────────────────────────────────────────────────────────
  // Must be registered before ':id/images' — otherwise 'import' is matched as an :id param.
  @Post('import/images') @Roles('data_manager', 'super_admin')
  async importImages() {
    return { success: true, data: await this.service.importCollegeImages() };
  }

  @Post(':id/images') @Roles('data_manager', 'super_admin')
  async addImage(@Param('id') id: string, @Body() dto: AddGalleryImageDto, @Req() req: AdminReq) {
    return { success: true, data: await this.service.addImage(id, dto, req.user.sub) };
  }

  // Must be registered before ':id/images/:imageId' — otherwise 'reorder' is matched as an :imageId param.
  @Patch(':id/images/reorder') @Roles('data_manager', 'super_admin')
  async reorderImages(@Param('id') id: string, @Body() dto: ReorderGalleryDto, @Req() req: AdminReq) {
    return { success: true, data: await this.service.reorderGallery(id, dto, req.user.sub) };
  }

  @Patch(':id/images/:imageId') @Roles('data_manager', 'super_admin')
  async updateImage(@Param('id') id: string, @Param('imageId') imageId: string, @Body() dto: UpdateGalleryImageDto, @Req() req: AdminReq) {
    return { success: true, data: await this.service.updateImage(id, imageId, dto, req.user.sub) };
  }

  @Delete(':id/images/:imageId') @Roles('data_manager', 'super_admin')
  async removeImage(@Param('id') id: string, @Param('imageId') imageId: string, @Req() req: AdminReq) {
    await this.service.removeImage(id, imageId, req.user.sub);
    return { success: true, data: { deleted: true } };
  }

  @Post(':id/images/:imageId/primary') @Roles('data_manager', 'super_admin')
  async setPrimaryImage(@Param('id') id: string, @Param('imageId') imageId: string, @Req() req: AdminReq) {
    return { success: true, data: await this.service.setPrimaryImage(id, imageId, req.user.sub) };
  }

  @Post(':id/images/:imageId/verify') @Roles('data_manager', 'super_admin')
  async verifyImage(@Param('id') id: string, @Param('imageId') imageId: string, @Req() req: AdminReq) {
    return { success: true, data: await this.service.verifyImage(id, imageId, req.user.sub) };
  }

  @Post(':id/images/:imageId/reject') @Roles('data_manager', 'super_admin')
  async rejectImage(@Param('id') id: string, @Param('imageId') imageId: string, @Req() req: AdminReq) {
    return { success: true, data: await this.service.rejectImage(id, imageId, req.user.sub) };
  }
}
