import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WishlistList, WishlistListDocument, DefaultListKey } from '../models/wishlist-list.model';

@Injectable()
export class WishlistListRepository {
  constructor(@InjectModel(WishlistList.name) private readonly model: Model<WishlistListDocument>) {}

  listForUser(userId: string) { return this.model.find({ userId }).sort({ order: 1, createdAt: 1 }).exec(); }
  findById(id: string) { return this.model.findById(id).exec(); }
  findByIdForUser(userId: string, id: string) { return this.model.findOne({ _id: id, userId }).exec(); }
  findByKey(userId: string, key: DefaultListKey) { return this.model.findOne({ userId, key }).exec(); }

  create(fields: Partial<WishlistList>) { return this.model.create(fields); }

  rename(userId: string, id: string, name: string) {
    return this.model.findOneAndUpdate({ _id: id, userId }, { $set: { name } }, { new: true }).exec();
  }

  delete(userId: string, id: string) {
    return this.model.findOneAndDelete({ _id: id, userId }).exec();
  }

  countForUser(userId: string) { return this.model.countDocuments({ userId }).exec(); }
}
