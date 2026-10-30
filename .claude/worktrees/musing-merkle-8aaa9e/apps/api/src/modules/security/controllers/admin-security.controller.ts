import { Controller, Get, Post, Param, Query, Body, Ip, Req } from '@nestjs/common';
import { Request } from 'express';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Roles, RequirePermissions } from '../../../common/decorators/auth.decorators';
import { PERMISSIONS } from '../../../common/permissions';
import { AdminSecurityService } from '../services/admin-security.service';
import { AccessTokenPayload } from '../../auth/services/token.service';

type AdminReq = Request & { user: AccessTokenPayload };

class ActorTypeDto { @IsIn(['student', 'admin']) actorType: 'student' | 'admin'; }
class DisableAccountDto extends ActorTypeDto { @IsOptional() @IsString() reason?: string; }

@Controller('admin/security')
@Roles('super_admin') @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
export class AdminSecurityController {
  constructor(private readonly svc: AdminSecurityService) {}

  @Get('failed-logins')
  async failedLogins(@Query('page') page?: string, @Query('limit') limit?: string) {
    return { success: true, data: await this.svc.failedLogins(Number(page) || 1, Number(limit) || 50) };
  }

  @Get('suspicious-logins')
  async suspiciousLogins(@Query('page') page?: string, @Query('limit') limit?: string) {
    return { success: true, data: await this.svc.suspiciousLogins(Number(page) || 1, Number(limit) || 50) };
  }

  @Get('locked-accounts')
  async lockedAccounts(@Query('page') page?: string, @Query('limit') limit?: string) {
    return { success: true, data: await this.svc.lockedAccounts(Number(page) || 1, Number(limit) || 50) };
  }

  @Get('active-sessions')
  async activeSessions(@Query('page') page?: string, @Query('limit') limit?: string) {
    return { success: true, data: await this.svc.activeSessions(Number(page) || 1, Number(limit) || 50) };
  }

  @Get('events')
  async events(@Query('page') page?: string, @Query('limit') limit?: string) {
    return { success: true, data: await this.svc.securityEvents(Number(page) || 1, Number(limit) || 50) };
  }

  @Get('analytics')
  async analytics(@Query('days') days?: string) {
    return { success: true, data: await this.svc.analytics(Number(days) || 30) };
  }

  @Post('force-logout/:userId')
  async forceLogout(@Param('userId') userId: string, @Body() dto: ActorTypeDto) {
    await this.svc.forceLogout(userId, dto.actorType);
    return { success: true, data: { loggedOut: true } };
  }

  @Post('unlock/:userId')
  async unlock(@Param('userId') userId: string, @Body() dto: ActorTypeDto) {
    await this.svc.unlock(userId, dto.actorType);
    return { success: true, data: { unlocked: true } };
  }

  @Post('disable/:userId')
  async disable(@Param('userId') userId: string, @Body() dto: DisableAccountDto, @Req() req: AdminReq, @Ip() ip: string) {
    await this.svc.disable(userId, dto.actorType, req.user.sub, ip, dto.reason ?? 'Disabled via Admin Security panel.');
    return { success: true, data: { disabled: true } };
  }
}
