import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WITH_ID_JSON } from '../../../common/utils/schema.util';

export type NotificationDeliveryLogDocument = NotificationDeliveryLog & Document;

// One row per (notification, channel) delivery attempt — powers the admin
// "delivery status / failed notifications" view without overloading the
// Notification document itself with per-channel attempt history.
@Schema({ timestamps: true, ...WITH_ID_JSON })
export class NotificationDeliveryLog {
  @Prop({ required: true }) notificationId: string;
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) channel: string;
  @Prop({ enum: ['sent', 'failed', 'skipped'], required: true }) status: string;
  @Prop() error?: string;
  @Prop({ type: Date, default: Date.now }) attemptedAt: Date;
}

export const NotificationDeliveryLogSchema = SchemaFactory.createForClass(NotificationDeliveryLog);
NotificationDeliveryLogSchema.index({ notificationId: 1 });
NotificationDeliveryLogSchema.index({ status: 1, attemptedAt: -1 });
NotificationDeliveryLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // TTL 90 days
