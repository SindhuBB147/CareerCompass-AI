import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WishlistListItemDocument = WishlistListItem & Document;

// Many-to-many join between WishlistList and a saved college — a college
// can sit in "Dream Colleges" AND a custom "Bangalore Colleges" list at
// once. A row here always implies a SavedCollege record exists for the
// same (userId, collegeId); WishlistService enforces that ordering.
@Schema({ timestamps: true })
export class WishlistListItem {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) listId: string;
  @Prop({ required: true }) collegeId: string;
  @Prop({ type: Date, default: () => new Date() }) addedAt: Date;
}

export const WishlistListItemSchema = SchemaFactory.createForClass(WishlistListItem);
WishlistListItemSchema.index({ listId: 1, collegeId: 1 }, { unique: true });
WishlistListItemSchema.index({ userId: 1, collegeId: 1 });
WishlistListItemSchema.index({ listId: 1, addedAt: -1 });
