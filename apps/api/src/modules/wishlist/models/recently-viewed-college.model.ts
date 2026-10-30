import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RecentlyViewedCollegeDocument = RecentlyViewedCollege & Document;

// Persists independently of SavedCollege — this is what lets a student
// "restore" a college they removed from their wishlist (it's still in
// their view history, so re-saving from here is the restore path; see
// RecentlyViewedService).
@Schema({ timestamps: true })
export class RecentlyViewedCollege {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) collegeId: string;
  @Prop({ type: Date, default: () => new Date() }) viewedAt: Date;
}

export const RecentlyViewedCollegeSchema = SchemaFactory.createForClass(RecentlyViewedCollege);
RecentlyViewedCollegeSchema.index({ userId: 1, collegeId: 1 }, { unique: true });
RecentlyViewedCollegeSchema.index({ userId: 1, viewedAt: -1 });
