import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ScholarshipCategoryDocument = ScholarshipCategory & Document;

@Schema({ timestamps: true })
export class ScholarshipCategory {
  @Prop({ required: true, unique: true }) slug: string;
  @Prop({ required: true }) name: string;
  @Prop() description?: string;
  @Prop() icon?: string;
  @Prop({ default: 0 }) sortOrder: number;
}

export const ScholarshipCategorySchema = SchemaFactory.createForClass(ScholarshipCategory);
ScholarshipCategorySchema.index({ sortOrder: 1 });
