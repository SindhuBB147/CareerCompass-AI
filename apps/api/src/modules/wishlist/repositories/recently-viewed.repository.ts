import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RecentlyViewedCollege, RecentlyViewedCollegeDocument } from '../models/recently-viewed-college.model';

const MAX_HISTORY_PER_USER = 50;

@Injectable()
export class RecentlyViewedRepository {
  constructor(@InjectModel(RecentlyViewedCollege.name) private readonly model: Model<RecentlyViewedCollegeDocument>) {}

  list(userId: string, limit = MAX_HISTORY_PER_USER) {
    return this.model.find({ userId }).sort({ viewedAt: -1 }).limit(limit).exec();
  }

  async record(userId: string, collegeId: string): Promise<void> {
    await this.model.findOneAndUpdate(
      { userId, collegeId },
      { $set: { viewedAt: new Date() }, $setOnInsert: { userId, collegeId } },
      { upsert: true },
    ).exec();
    await this.trim(userId);
  }

  clear(userId: string) {
    return this.model.deleteMany({ userId }).exec();
  }

  /** Keeps only the most recent MAX_HISTORY_PER_USER rows per user. */
  private async trim(userId: string): Promise<void> {
    const excess = await this.model
      .find({ userId })
      .sort({ viewedAt: -1 })
      .skip(MAX_HISTORY_PER_USER)
      .select('_id')
      .exec();
    if (excess.length === 0) return;
    await this.model.deleteMany({ _id: { $in: excess.map(e => e._id) } }).exec();
  }
}
