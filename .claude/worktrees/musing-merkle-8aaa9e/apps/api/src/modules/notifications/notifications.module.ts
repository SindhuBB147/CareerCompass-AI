import {
  Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, Req,
} from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Request } from 'express';
import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';
import { Notification, NotificationSchema, NOTIFICATION_CATEGORIES, NOTIFICATION_PRIORITIES } from './models/notification.model';
import { NotificationPreference, NotificationPreferenceSchema } from './models/notification-preference.model';
import { NotificationTemplate, NotificationTemplateSchema } from './models/notification-template.model';
import { Reminder, ReminderSchema, REMINDER_TYPES } from './models/reminder.model';
import { NotificationDeliveryLog, NotificationDeliveryLogSchema } from './models/notification-delivery-log.model';
import { AuditLog, AuditLogSchema } from '../colleges/models/audit-log.model';
import { Exam, ExamSchema } from '../cutoffs/models/exam.model';
import { Scholarship, ScholarshipSchema } from '../scholarships/models/scholarship.model';
import { Roadmap, RoadmapSchema } from '../roadmap/models/roadmap.model';
import { SavedCollege, SavedCollegeSchema } from '../wishlist/models/saved-college.model';
import { NotificationService } from './services/notification.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationDispatchService } from './services/notification-dispatch.service';
import { NotificationEventListenerService } from './services/notification-event-listener.service';
import { NotificationSchedulerService } from './services/notification-scheduler.service';
import { NotificationAdminService } from './services/notification-admin.service';
import { ReminderService } from './services/reminder.service';
import { AdminNotificationController } from './admin-notifications.controller';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { MailerModule } from '../../common/mailer/mailer.module';
import { Roles } from '../../common/decorators/auth.decorators';
import { AccessTokenPayload } from '../auth/services/token.service';

type AuthReq = Request & { user: AccessTokenPayload };

// ── DTOs ──────────────────────────────────────────────────────────────────────

export class ListNotificationsDto {
  @IsOptional() @IsEnum(['pending', 'sent', 'failed', 'read']) status?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsIn(NOTIFICATION_CATEGORIES) category?: string;
  @IsOptional() @IsIn(NOTIFICATION_PRIORITIES) priority?: string;
  @IsOptional() @IsBoolean() isRead?: boolean;
  @IsOptional() @IsBoolean() isFavorite?: boolean;
  @IsOptional() @IsBoolean() isArchived?: boolean;
  @IsOptional() @IsString() search?: string;
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
}

export class ArchiveDto { @IsBoolean() isArchived: boolean; }
export class FavoriteDto { @IsBoolean() isFavorite: boolean; }

export class NudgeDto {
  @IsString() @MinLength(1) @MaxLength(500) message: string;
  @IsArray() @IsString({ each: true }) channels: string[];
}

export class UpdatePreferenceDto {
  @IsOptional() channels?: Partial<Record<'inApp' | 'email' | 'browser' | 'sms' | 'whatsapp' | 'push', boolean>>;
  @IsOptional() categories?: Partial<Record<typeof NOTIFICATION_CATEGORIES[number], boolean>>;
  @IsOptional() @IsBoolean() weeklySummary?: boolean;
  @IsOptional() @IsBoolean() marketingEmails?: boolean;
}

export class CreateReminderDto {
  @IsIn(REMINDER_TYPES) type: string;
  @IsString() @MinLength(1) @MaxLength(150) title: string;
  @IsDateString() remindAt: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() relatedEntityId?: string;
}

// ── Student Controller ────────────────────────────────────────────────────────

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly svc: NotificationService,
    private readonly preferenceSvc: NotificationPreferenceService,
    private readonly reminderSvc: ReminderService,
  ) {}

  @Get()
  async list(@Query() q: ListNotificationsDto, @Req() req: AuthReq) {
    const result = await this.svc.listForUser(req.user.sub, q, q.page, q.limit);
    return { success: true, data: result };
  }

  @Get('unread-count')
  async unreadCount(@Req() req: AuthReq) {
    return { success: true, data: { count: await this.svc.unreadCount(req.user.sub) } };
  }

  @Patch('read-all')
  async markAllRead(@Req() req: AuthReq) {
    const count = await this.svc.markAllRead(req.user.sub);
    return { success: true, data: { updated: count } };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Req() req: AuthReq) {
    const notif = await this.svc.markRead(req.user.sub, id);
    return { success: true, data: { notificationId: notif.id, isRead: true } };
  }

  @Patch(':id/archive')
  async archive(@Param('id') id: string, @Body() dto: ArchiveDto, @Req() req: AuthReq) {
    const notif = await this.svc.setArchived(req.user.sub, id, dto.isArchived);
    return { success: true, data: { notificationId: notif.id, isArchived: notif.isArchived } };
  }

  @Patch(':id/favorite')
  async favorite(@Param('id') id: string, @Body() dto: FavoriteDto, @Req() req: AuthReq) {
    const notif = await this.svc.setFavorite(req.user.sub, id, dto.isFavorite);
    return { success: true, data: { notificationId: notif.id, isFavorite: notif.isFavorite } };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthReq) {
    await this.svc.remove(req.user.sub, id);
    return { success: true, data: { notificationId: id, deleted: true } };
  }

  @Get('preferences')
  async getPreferences(@Req() req: AuthReq) {
    return { success: true, data: await this.preferenceSvc.getOrCreate(req.user.sub) };
  }

  @Patch('preferences')
  async updatePreferences(@Body() dto: UpdatePreferenceDto, @Req() req: AuthReq) {
    return { success: true, data: await this.preferenceSvc.update(req.user.sub, dto) };
  }

  @Get('reminders')
  async listReminders(@Req() req: AuthReq) {
    return { success: true, data: await this.reminderSvc.listForUser(req.user.sub) };
  }

  @Post('reminders')
  async createReminder(@Body() dto: CreateReminderDto, @Req() req: AuthReq) {
    const reminder = await this.reminderSvc.create({ ...dto, userId: req.user.sub, remindAt: new Date(dto.remindAt) });
    return { success: true, data: reminder };
  }

  @Delete('reminders/:id')
  async cancelReminder(@Param('id') id: string, @Req() req: AuthReq) {
    await this.reminderSvc.cancel(req.user.sub, id);
    return { success: true, data: { reminderId: id, cancelled: true } };
  }
}

// ── B2B Controller ────────────────────────────────────────────────────────────

@Controller('b2b/students')
export class B2bNotificationController {
  constructor(private readonly svc: NotificationService) {}

  @Post(':userId/nudge') @Roles('b2b_account_manager')
  async nudge(@Param('userId') userId: string, @Body() dto: NudgeDto) {
    const notif = await this.svc.sendNudge(userId, dto.message, dto.channels);
    return { success: true, data: { notificationId: notif.id, status: 'pending' } };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationPreference.name, schema: NotificationPreferenceSchema },
      { name: NotificationTemplate.name, schema: NotificationTemplateSchema },
      { name: Reminder.name, schema: ReminderSchema },
      { name: NotificationDeliveryLog.name, schema: NotificationDeliveryLogSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      // Read-only schemas for the scheduler's cron scans — registered here
      // directly (not via importing CutoffsModule/ScholarshipsModule/
      // RoadmapModule) because those modules already import
      // NotificationsModule for the legacy NotificationService, and a
      // reverse import would create a circular module graph. Same
      // multi-registration pattern the codebase already uses for User
      // (registered in both AuthModule and UsersModule).
      { name: Exam.name, schema: ExamSchema },
      { name: Scholarship.name, schema: ScholarshipSchema },
      { name: Roadmap.name, schema: RoadmapSchema },
      // Same reasoning: WishlistModule imports CollegesModule/Scholarships-
      // Module/etc., so importing WishlistModule here would risk a cycle —
      // the SavedCollege schema is read-only for onCollegeUpdated's audience.
      { name: SavedCollege.name, schema: SavedCollegeSchema },
    ]),
    UsersModule, AuthModule, MailerModule,
  ],
  controllers: [NotificationController, B2bNotificationController, AdminNotificationController],
  providers: [
    NotificationService, NotificationPreferenceService, NotificationDispatchService,
    NotificationEventListenerService, NotificationSchedulerService, NotificationAdminService, ReminderService,
  ],
  exports: [NotificationService, NotificationDispatchService, NotificationPreferenceService],
})
export class NotificationsModule {}
