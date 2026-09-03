import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { NotificationAdminService } from './services/notification-admin.service';
import { NotificationService } from './services/notification.service';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_PRIORITIES } from './models/notification.model';
import { Roles } from '../../common/decorators/auth.decorators';
import { AccessTokenPayload } from '../auth/services/token.service';

type AdminReq = Request & { user: AccessTokenPayload };

// ── DTOs ──────────────────────────────────────────────────────────────────────

export class BroadcastDto {
  @IsString() @MinLength(1) @MaxLength(150) title: string;
  @IsString() @MinLength(1) @MaxLength(2000) message: string;
  @IsOptional() @IsIn(NOTIFICATION_CATEGORIES) category?: string;
  @IsOptional() @IsIn(NOTIFICATION_PRIORITIES) priority?: string;
  @IsOptional() @IsString() actionUrl?: string;
}

export class TargetedSendDto extends BroadcastDto {
  @IsArray() @IsString({ each: true }) userIds: string[];
}

export class UpsertTemplateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() htmlBody?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class DeliveryStatusQueryDto {
  @IsOptional() @IsEnum(['sent', 'failed', 'skipped']) status?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
}

// ── Controller ───────────────────────────────────────────────────────────────

@Controller('admin/notifications')
@Roles('data_manager', 'super_admin')
export class AdminNotificationController {
  constructor(
    private readonly adminSvc: NotificationAdminService,
    private readonly notificationService: NotificationService,
  ) {}

  @Post('broadcast')
  async broadcast(@Body() dto: BroadcastDto, @Req() req: AdminReq) {
    const recipients = await this.adminSvc.broadcast(req.user.sub, dto);
    return { success: true, data: { recipients } };
  }

  @Post('targeted')
  async targeted(@Body() dto: TargetedSendDto, @Req() req: AdminReq) {
    const recipients = await this.adminSvc.targetedSend(req.user.sub, dto.userIds, dto);
    return { success: true, data: { recipients } };
  }

  @Post('announcement')
  async announcement(@Body() dto: BroadcastDto, @Req() req: AdminReq) {
    const recipients = await this.adminSvc.createAnnouncement(req.user.sub, dto);
    return { success: true, data: { recipients } };
  }

  @Get('templates')
  async listTemplates() {
    return { success: true, data: await this.adminSvc.listTemplates() };
  }

  @Patch('templates/:key')
  async upsertTemplate(@Param('key') key: string, @Body() dto: UpsertTemplateDto, @Req() req: AdminReq) {
    const template = await this.adminSvc.upsertTemplate(req.user.sub, key, dto);
    return { success: true, data: template };
  }

  @Post('templates/:key/reset')
  async resetTemplate(@Param('key') key: string, @Req() req: AdminReq) {
    await this.adminSvc.resetTemplate(req.user.sub, key);
    return { success: true, data: { key, reset: true } };
  }

  @Get('delivery-status')
  async deliveryStatus(@Query() q: DeliveryStatusQueryDto) {
    const result = await this.adminSvc.deliveryStatus({ status: q.status, channel: q.channel }, q.page ?? 1, q.limit ?? 20);
    return { success: true, data: result };
  }

  // Admin-targeted system alerts (ADMIN_SYSTEM_EVENT fan-out) — any
  // authenticated admin can read/clear their own, no extra role check needed
  // beyond the class-level @Roles() above.
  @Get('my')
  async myAlerts(@Req() req: AdminReq, @Query('page') page?: number, @Query('limit') limit?: number) {
    const result = await this.notificationService.listForUser(req.user.sub, {}, page ?? 1, limit ?? 20);
    return { success: true, data: result };
  }

  @Patch('my/:id/read')
  async markMyAlertRead(@Param('id') id: string, @Req() req: AdminReq) {
    const notif = await this.notificationService.markRead(req.user.sub, id);
    return { success: true, data: { notificationId: notif.id, isRead: true } };
  }
}
