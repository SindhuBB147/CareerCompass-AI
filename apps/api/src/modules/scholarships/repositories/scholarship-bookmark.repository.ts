import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScholarshipBookmark, ScholarshipBookmarkDocument } from '../models/scholarship-bookmark.model';

@Injectable()
export class ScholarshipBookmarkRepository {
  constructor(@InjectModel(ScholarshipBookmark.name) private readonly model: Model<ScholarshipBookmarkDocument>) {}

  listForUser(userId: string) { return this.model.find({ userId }).sort({ createdAt: -1 }).exec(); }
  find(userId: string, scholarshipId: string) { return this.model.findOne({ userId, scholarshipId }).exec(); }

  /** Idempotent — bookmarking an already-bookmarked scholarship is a no-op, not an error. */
  async add(userId: string, scholarshipId: string) {
    return this.model.findOneAndUpdate(
      { userId, scholarshipId },
      { $setOnInsert: { userId, scholarshipId } },
      { upsert: true, new: true },
    ).exec();
  }

  remove(userId: string, scholarshipId: string) {
    return this.model.findOneAndDelete({ userId, scholarshipId }).exec();
  }

  countForScholarship(scholarshipId: string) {
    return this.model.countDocuments({ scholarshipId }).exec();
  }
}
