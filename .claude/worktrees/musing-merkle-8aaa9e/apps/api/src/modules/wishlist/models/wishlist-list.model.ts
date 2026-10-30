import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WishlistListDocument = WishlistList & Document;

// The 5 default lists every student gets, lazily created on first wishlist
// read (see WishlistService.ensureDefaultLists) rather than seeded at
// registration — keeps the auth/registration flow untouched.
export const DEFAULT_LIST_KEYS = ['dream', 'target', 'safe', 'favorites', 'recently_viewed'] as const;
export type DefaultListKey = typeof DEFAULT_LIST_KEYS[number];

export const DEFAULT_LIST_DEFINITIONS: Record<DefaultListKey, { name: string; icon: string; order: number }> = {
  dream: { name: 'Dream Colleges', icon: '⭐', order: 1 },
  target: { name: 'Target Colleges', icon: '🎯', order: 2 },
  safe: { name: 'Safe Colleges', icon: '🛡', order: 3 },
  favorites: { name: 'Favorites', icon: '❤️', order: 4 },
  recently_viewed: { name: 'Recently Viewed', icon: '📌', order: 5 },
};

@Schema({ timestamps: true })
export class WishlistList {
  @Prop({ required: true }) userId: string;
  // Null for custom lists — only the 5 defaults carry a key, which is what
  // blocks rename/delete (see DefaultListNotEditableException).
  @Prop({ type: String, enum: DEFAULT_LIST_KEYS, default: null }) key: DefaultListKey | null;
  @Prop({ required: true }) name: string;
  @Prop({ default: '📁' }) icon: string;
  @Prop({ type: String, enum: ['default', 'custom'], required: true }) type: 'default' | 'custom';
  @Prop({ default: 0 }) order: number;
}

export const WishlistListSchema = SchemaFactory.createForClass(WishlistList);
WishlistListSchema.index({ userId: 1, order: 1 });
WishlistListSchema.index({ userId: 1, key: 1 }, { unique: true, partialFilterExpression: { key: { $type: 'string' } } });
