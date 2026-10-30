import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SavedCollegeDocument = SavedCollege & Document;

export const BOOKMARK_STATUSES = [
  'dream', 'target', 'safe', 'backup', 'interested', 'applied', 'admitted', 'rejected',
] as const;
export type BookmarkStatus = typeof BOOKMARK_STATUSES[number];

export class CollegeNote {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) text: string;
  @Prop({ type: Date, default: () => new Date() }) createdAt: Date;
}

// The "is this college saved at all" record — one per (userId, collegeId).
// Removing this removes the college from every list it was in (see
// WishlistListItem) since a college can't belong to a list without being
// saved. Distinct from WishlistListItem: this holds the college-scoped
// metadata (status tag, notes) that doesn't vary per-list.
@Schema({ timestamps: true })
export class SavedCollege {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) collegeId: string;
  @Prop({ type: String, enum: BOOKMARK_STATUSES, default: 'interested' }) status: BookmarkStatus;
  @Prop({ type: [CollegeNote], default: [] }) notes: CollegeNote[];
}

export const SavedCollegeSchema = SchemaFactory.createForClass(SavedCollege);
SavedCollegeSchema.index({ userId: 1, collegeId: 1 }, { unique: true });
SavedCollegeSchema.index({ userId: 1, createdAt: -1 });
SavedCollegeSchema.index({ collegeId: 1 });
SavedCollegeSchema.index({ userId: 1, status: 1 });
