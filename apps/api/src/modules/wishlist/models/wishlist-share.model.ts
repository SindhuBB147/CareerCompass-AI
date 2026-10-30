import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WishlistShareDocument = WishlistShare & Document;

@Schema({ timestamps: true })
export class WishlistShare {
  @Prop({ required: true, unique: true }) token: string;
  @Prop({ required: true }) userId: string;
  @Prop({ type: String, enum: ['wishlist', 'list', 'comparison'], required: true }) kind: 'wishlist' | 'list' | 'comparison';
  @Prop({ type: [String], default: [] }) collegeIds: string[];
  @Prop({ type: String, default: null }) listId: string | null;
  @Prop({ type: Date, default: null }) expiresAt: Date | null;
}

export const WishlistShareSchema = SchemaFactory.createForClass(WishlistShare);
WishlistShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
