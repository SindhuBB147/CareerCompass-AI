import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ScholarshipProviderDocument = ScholarshipProvider & Document;

@Schema({ timestamps: true })
export class ScholarshipProvider {
  @Prop({ required: true }) name: string;
  @Prop({ enum: ['government_central', 'government_state', 'private', 'institution', 'ngo', 'corporate'], required: true })
  type: string;
  @Prop() website?: string;
  @Prop() contactEmail?: string;
  @Prop() contactPhone?: string;
  @Prop() description?: string;
}

export const ScholarshipProviderSchema = SchemaFactory.createForClass(ScholarshipProvider);
ScholarshipProviderSchema.index({ name: 1 }, { unique: true });
