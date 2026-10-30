import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SearchHistory, SearchHistoryDocument } from '../models/search-history.model';
import { maskPii } from '../../../common/utils/pii';

export interface PopularSearchEntry {
  query: string;
  count: number;
  lastIntent: string | null;
}

@Injectable()
export class SearchHistoryService {
  constructor(
    @InjectModel(SearchHistory.name) private readonly model: Model<SearchHistoryDocument>,
  ) {}

  async log(
    userId: string,
    rawQuery: string,
    intent: string,
    entities: Record<string, unknown>,
    resultCounts: Record<string, number>,
  ): Promise<SearchHistoryDocument> {
    return this.model.create({
      userId, queryMasked: maskPii(rawQuery), intent, entities, resultCounts,
    });
  }

  listRecent(userId: string, limit = 10) {
    return this.model.find({ userId, isSaved: false }).sort({ createdAt: -1 }).limit(limit).exec();
  }

  listSaved(userId: string) {
    return this.model.find({ userId, isSaved: true }).sort({ createdAt: -1 }).exec();
  }

  save(userId: string, historyId: string, label?: string): Promise<SearchHistoryDocument | null> {
    return this.model.findOneAndUpdate(
      { _id: historyId, userId },
      { $set: { isSaved: true, savedLabel: label } },
      { new: true },
    ).exec();
  }

  async unsave(userId: string, historyId: string): Promise<void> {
    await this.model.updateOne({ _id: historyId, userId }, { $set: { isSaved: false, savedLabel: undefined } }).exec();
  }

  /** Search Memory — bulk clear for the Memory & Privacy page. Removes both recent and saved searches. */
  async clearAll(userId: string): Promise<void> {
    await this.model.deleteMany({ userId }).exec();
  }

  async recordClick(userId: string, historyId: string, resultId: string): Promise<void> {
    await this.model.updateOne({ _id: historyId, userId }, { $addToSet: { clickedResultIds: resultId } }).exec();
  }

  async popular(limit = 10, sinceDays = 30): Promise<PopularSearchEntry[]> {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const rows = await this.model.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$queryMasked', count: { $sum: 1 }, lastIntent: { $last: '$intent' } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, query: '$_id', count: 1, lastIntent: 1 } },
    ]).exec();
    return rows;
  }

  async getAnalytics(from?: Date, to?: Date) {
    const dateFrom = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ?? new Date();
    const match = { createdAt: { $gte: dateFrom, $lte: dateTo } };

    const [totalSearches, zeroResultSearches, popularQueries, intentBreakdown] = await Promise.all([
      this.model.countDocuments(match).exec(),
      this.model.countDocuments({ ...match, 'resultCounts.colleges': 0 }).exec(),
      this.popular(10, Math.ceil((dateTo.getTime() - dateFrom.getTime()) / 86_400_000) || 30),
      this.model.aggregate([
        { $match: match },
        { $group: { _id: '$intent', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, intent: '$_id', count: 1 } },
      ]).exec(),
    ]);

    const zeroResultRate = totalSearches > 0 ? Math.round((zeroResultSearches / totalSearches) * 1000) / 1000 : 0;

    return { totalSearches, zeroResultSearches, zeroResultRate, popularQueries, intentBreakdown };
  }
}
