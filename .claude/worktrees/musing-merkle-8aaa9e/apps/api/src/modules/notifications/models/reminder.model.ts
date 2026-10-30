import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WITH_ID_JSON } from '../../../common/utils/schema.util';

export type ReminderDocument = Reminder & Document;

export const REMINDER_TYPES = [
  'counselling', 'scholarship_deadline', 'roadmap_task', 'exam', 'document_submission', 'loan_payment', 'custom',
] as const;
export type ReminderType = typeof REMINDER_TYPES[number];

@Schema({ timestamps: true, ...WITH_ID_JSON })
export class Reminder {
  @Prop({ required: true }) userId: string;
  @Prop({ enum: REMINDER_TYPES, required: true }) type: string;
  @Prop({ required: true }) title: string;
  @Prop() note?: string;
  @Prop({ required: true }) remindAt: Date;
  @Prop() relatedEntityId?: string;
  @Prop({ enum: ['pending', 'fired', 'cancelled'], default: 'pending' }) status: string;
}

export const ReminderSchema = SchemaFactory.createForClass(Reminder);
ReminderSchema.index({ userId: 1, status: 1, remindAt: 1 });
ReminderSchema.index({ remindAt: 1, status: 1 });
