import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationTemplate, NotificationTemplateSchema } from '../../modules/notifications/models/notification-template.model';
import { MailerService } from './mailer.service';

// Standalone module (no dependency on NotificationsModule/UsersModule) so
// AuthService/UserService/NotificationsModule can all send email without
// creating a circular Nest module graph.
@Module({
  imports: [
    MongooseModule.forFeature([{ name: NotificationTemplate.name, schema: NotificationTemplateSchema }]),
  ],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
