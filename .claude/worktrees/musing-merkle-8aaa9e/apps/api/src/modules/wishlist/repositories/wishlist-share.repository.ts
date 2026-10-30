import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WishlistShare, WishlistShareDocument } from '../models/wishlist-share.model';

@Injectable()
export class WishlistShareRepository {
  constructor(@InjectModel(WishlistShare.name) private readonly model: Model<WishlistShareDocument>) {}

  create(fields: Partial<WishlistShare>) { return this.model.create(fields); }
  findByToken(token: string) { return this.model.findOne({ token }).exec(); }
}
