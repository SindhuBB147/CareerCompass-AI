import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ComparisonSnapshot, ComparisonSnapshotDocument } from '../models/comparison-snapshot.model';

const MAX_HISTORY_PER_USER = 20;

@Injectable()
export class ComparisonSnapshotRepository {
  constructor(@InjectModel(ComparisonSnapshot.name) private readonly model: Model<ComparisonSnapshotDocument>) {}

  list(userId: string) {
    return this.model.find({ userId }).sort({ createdAt: -1 }).limit(MAX_HISTORY_PER_USER).exec();
  }

  async record(userId: string, collegeIds: string[], name?: string): Promise<ComparisonSnapshotDocument> {
    const snapshot = await this.model.create({ userId, collegeIds, name });
    await this.trim(userId);
    return snapshot;
  }

  /** Most-compared colleges across all users, for the admin analytics dashboard. */
  mostCompared(limit = 10) {
    return this.model.aggregate([
      { $unwind: '$collegeIds' },
      { $group: { _id: '$collegeIds', comparisons: { $sum: 1 } } },
      { $sort: { comparisons: -1 } },
      { $limit: limit },
    ]).exec();
  }

  private async trim(userId: string): Promise<void> {
    const excess = await this.model
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(MAX_HISTORY_PER_USER)
      .select('_id')
      .exec();
    if (excess.length === 0) return;
    await this.model.deleteMany({ _id: { $in: excess.map(e => e._id) } }).exec();
  }
}
