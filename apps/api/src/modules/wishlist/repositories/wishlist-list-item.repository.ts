import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WishlistListItem, WishlistListItemDocument } from '../models/wishlist-list-item.model';

@Injectable()
export class WishlistListItemRepository {
  constructor(@InjectModel(WishlistListItem.name) private readonly model: Model<WishlistListItemDocument>) {}

  findByList(listId: string) { return this.model.find({ listId }).sort({ addedAt: -1 }).exec(); }
  findByUser(userId: string) { return this.model.find({ userId }).exec(); }
  findListIdsForCollege(userId: string, collegeId: string) {
    return this.model.distinct('listId', { userId, collegeId }).exec() as Promise<string[]>;
  }

  async add(userId: string, listId: string, collegeId: string) {
    return this.model.findOneAndUpdate(
      { listId, collegeId },
      { $setOnInsert: { userId, listId, collegeId, addedAt: new Date() } },
      { upsert: true, new: true },
    ).exec();
  }

  remove(listId: string, collegeId: string) {
    return this.model.findOneAndDelete({ listId, collegeId }).exec();
  }

  removeAllForCollege(userId: string, collegeId: string) {
    return this.model.deleteMany({ userId, collegeId }).exec();
  }

  removeAllForList(listId: string) {
    return this.model.deleteMany({ listId }).exec();
  }

  countForList(listId: string) { return this.model.countDocuments({ listId }).exec(); }

  /** Item counts grouped by list — powers the admin "Popular Lists" analytic.
   * listId is stored as a plain string (see WishlistListItem model), so it
   * has to be cast to ObjectId before it can $lookup against WishlistList._id. */
  countPerListName() {
    return this.model.aggregate([
      { $addFields: { listObjectId: { $toObjectId: '$listId' } } },
      { $lookup: { from: 'wishlistlists', localField: 'listObjectId', foreignField: '_id', as: 'list' } },
      { $unwind: '$list' },
      { $group: { _id: '$list.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]).exec();
  }
}
