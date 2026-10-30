import {
  Body, Controller, Delete, Get, Ip, Module, Param, Patch, Post, Query, Req,
} from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Request } from 'express';
import {
  ArrayUnique, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn,
  IsOptional, IsString, MinLength,
} from 'class-validator';
import { User, UserSchema } from '../users/models/user.model';
import { AdminUser, AdminUserSchema, AdminRole, ADMIN_ROLES } from '../auth/models/admin-user.model';
import { AuditLog, AuditLogSchema } from '../colleges/models/audit-log.model';
import { AdminService } from './services/admin.service';
import { Roles, RequirePermissions, RequireReauth } from '../../common/decorators/auth.decorators';
import { PERMISSIONS, ALL_PERMISSIONS } from '../../common/permissions';
import { AccessTokenPayload } from '../auth/services/token.service';
import { AuthModule } from '../auth/auth.module';

type AdminReq = Request & { user: AccessTokenPayload };

// ── DTOs ──────────────────────────────────────────────────────────────────────

class SearchUsersDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsEnum(['active', 'suspended', 'deleted']) accountStatus?: string;
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
}

class UpdateUserStatusDto {
  @IsEnum(['active', 'suspended', 'deleted']) accountStatus: string;
  @IsString() reason: string;
}

class AuditLogQueryDto {
  @IsOptional() @IsString() targetCollection?: string;
  @IsOptional() @IsString() targetId?: string;
  @IsOptional() @IsString() adminId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
}

class B2bStudentsQueryDto {
  @IsOptional() @IsString() examCode?: string;
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
}

class ListAdminsDto {
  @IsOptional() @IsIn(ADMIN_ROLES) role?: AdminRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() q?: string;
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
}

class CreateAdminDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(10) password: string;
  @IsIn(ADMIN_ROLES) role: AdminRole;
  @IsOptional() @IsArray() @IsIn(ALL_PERMISSIONS, { each: true }) @ArrayUnique() permissions?: string[];
}

class UpdateAdminDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(ADMIN_ROLES) role?: AdminRole;
  @IsOptional() @IsArray() @IsIn(ALL_PERMISSIONS, { each: true }) @ArrayUnique() permissions?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── User Management Controller ────────────────────────────────────────────────

@Controller('admin/users')
export class AdminUserController {
  constructor(private readonly svc: AdminService) {}

  @Get() @Roles('support_agent', 'data_manager', 'super_admin')
  async search(@Query() q: SearchUsersDto) {
    const result = await this.svc.searchUsers(q, q.page ?? 1, q.limit ?? 20);
    return { success: true, data: result };
  }

  @Patch(':userId/status') @Roles('support_agent', 'data_manager', 'super_admin') @RequireReauth()
  async updateStatus(@Param('userId') uid: string, @Body() dto: UpdateUserStatusDto) {
    const user = await this.svc.updateUserStatus(uid, dto.accountStatus, dto.reason);
    return { success: true, data: { userId: user.id, accountStatus: user.accountStatus } };
  }
}

// ── Admin Account Management Controller (Roles & Permissions) ─────────────────

@Controller('admin/admins')
export class AdminAccountController {
  constructor(private readonly svc: AdminService) {}

  @Get() @Roles('super_admin')
  async list(@Query() q: ListAdminsDto) {
    const result = await this.svc.listAdmins(q, q.page ?? 1, q.limit ?? 20);
    return { success: true, data: result };
  }

  @Get('permissions') @Roles('super_admin')
  listPermissions() {
    return { success: true, data: { permissions: ALL_PERMISSIONS, roles: ADMIN_ROLES } };
  }

  @Post() @Roles('super_admin') @RequirePermissions(PERMISSIONS.ADMINS_MANAGE)
  async create(@Body() dto: CreateAdminDto, @Req() req: AdminReq, @Ip() ip: string) {
    const created = await this.svc.createAdmin(dto, req.user.sub, ip);
    return { success: true, data: created };
  }

  @Patch(':id') @Roles('super_admin') @RequirePermissions(PERMISSIONS.ADMINS_MANAGE) @RequireReauth()
  async update(@Param('id') id: string, @Body() dto: UpdateAdminDto, @Req() req: AdminReq, @Ip() ip: string) {
    const updated = await this.svc.updateAdmin(id, dto, req.user.sub, ip);
    return { success: true, data: updated };
  }

  @Post(':id/reset-password') @Roles('super_admin') @RequirePermissions(PERMISSIONS.ADMINS_MANAGE)
  async resetPassword(@Param('id') id: string, @Req() req: AdminReq, @Ip() ip: string) {
    const result = await this.svc.resetAdminPassword(id, req.user.sub, ip);
    return { success: true, data: result };
  }

  @Delete(':id') @Roles('super_admin') @RequirePermissions(PERMISSIONS.ADMINS_MANAGE) @RequireReauth()
  async remove(@Param('id') id: string, @Req() req: AdminReq, @Ip() ip: string) {
    await this.svc.deleteAdmin(id, req.user.sub, ip);
    return { success: true, data: { deleted: true } };
  }
}

// ── Audit Log Controller ──────────────────────────────────────────────────────

@Controller('admin/audit-logs')
export class AuditLogController {
  constructor(private readonly svc: AdminService) {}

  @Get() @Roles('super_admin')
  async list(@Query() q: AuditLogQueryDto) {
    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;
    const result = await this.svc.getAuditLogs({
      ...q, from, to, page: q.page ?? 1, limit: q.limit ?? 50,
    });
    return { success: true, data: result };
  }
}

// ── B2B Roster Controller ─────────────────────────────────────────────────────

@Controller('b2b/students')
export class B2bStudentsController {
  constructor(private readonly svc: AdminService) {}

  @Get() @Roles('b2b_account_manager')
  async roster(@Query() q: B2bStudentsQueryDto) {
    const result = await this.svc.listRosterStudents(
      { examCode: q.examCode }, q.page ?? 1, q.limit ?? 20,
    );
    return { success: true, data: result };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AdminUser.name, schema: AdminUserSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    AuthModule,
  ],
  controllers: [AdminUserController, AdminAccountController, AuditLogController, B2bStudentsController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
