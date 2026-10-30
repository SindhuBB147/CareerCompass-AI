import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WITH_ID_JSON } from '../../../common/utils/schema.util';

export type NotificationTemplateDocument = NotificationTemplate & Document;

// Admin-manageable email templates. `key` matches one of MailerService's
// built-in TEMPLATE_KEYS (see mailer.service.ts) — an admin edit here
// overrides the built-in default at send time; deleting a row reverts to
// the built-in. `htmlBody` uses `{{variable}}` placeholders substituted by
// MailerService.render().
@Schema({ timestamps: true, ...WITH_ID_JSON })
export class NotificationTemplate {
  @Prop({ required: true, unique: true }) key: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) subject: string;
  @Prop({ required: true }) htmlBody: string;
  @Prop() category?: string;
  @Prop({ type: [String], default: [] }) availableVariables: string[];
  @Prop({ default: true }) isActive: boolean;
}

export const NotificationTemplateSchema = SchemaFactory.createForClass(NotificationTemplate);
