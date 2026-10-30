import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ScholarshipBookmarkDocument = ScholarshipBookmark & Document;

@Schema({ timestamps: true })
export class ScholarshipBookmark {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) scholarshipId: string;
}

export const ScholarshipBookmarkSchema = SchemaFactory.createForClass(ScholarshipBookmark);
ScholarshipBookmarkSchema.index({ userId: 1, scholarshipId: 1 }, { unique: true });
ScholarshipBookmarkSchema.index({ userId: 1, createdAt: -1 });
