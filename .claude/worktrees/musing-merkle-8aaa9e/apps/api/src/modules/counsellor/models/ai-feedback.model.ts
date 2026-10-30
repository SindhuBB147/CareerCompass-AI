import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiFeedbackDocument = AiFeedback & Document;

@Schema({ timestamps: true })
export class AiFeedback {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) sessionId: string;
  @Prop({ required: true, min: 0 }) messageIndex: number;
  @Prop({ enum: ['up', 'down'], required: true }) rating: string;
  @Prop() comment?: string;
}

export const AiFeedbackSchema = SchemaFactory.createForClass(AiFeedback);
AiFeedbackSchema.index({ sessionId: 1, messageIndex: 1 });
AiFeedbackSchema.index({ rating: 1 });
