import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SavedCollege, SavedCollegeDocument } from '../models/saved-college.model';
import { WishlistListItemRepository } from '../repositories/wishlist-list-item.repository';
import { ComparisonSnapshotRepository } from '../repositories/comparison-snapshot.repository';
import { CollegeRepository } from '../../colleges/repositories/college.repository';

export interface WishlistAnalytics {
  mostSaved: Array<{ collegeId: string; collegeName: string; saves: number }>;
  trending: Array<{ collegeId: string; collegeName: string; savesLast7Days: number }>;
  mostCompared: Array<{ collegeId: string; collegeName: string; comparisons: number }>;
  popularLists: Array<{ name: string; count: number }>;
  bookmarkStatusBreakdown: Array<{ status: string; count: number }>;
}

@Injectable()
export class WishlistAnalyticsService {
  constructor(
    @InjectModel(SavedCollege.name) private readonly savedCollegeModel: Model<SavedCollegeDocument>,
    private readonly listItemRepo: WishlistListItemRepository,
    private readonly snapshotRepo: ComparisonSnapshotRepository,
    private readonly collegeRepo: CollegeRepository,
  ) {}

  async getAnalytics(): Promise<WishlistAnalytics> {
    const [mostSavedRaw, trendingRaw, mostComparedRaw, popularLists, statusRaw] = await Promise.all([
      this.savedCollegeModel.aggregate([
        { $group: { _id: '$collegeId', saves: { $sum: 1 } } },
        { $sort: { saves: -1 } },
        { $limit: 10 },
      ]).exec(),
      this.savedCollegeModel.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: '$collegeId', savesLast7Days: { $sum: 1 } } },
        { $sort: { savesLast7Days: -1 } },
        { $limit: 10 },
      ]).exec(),
      this.snapshotRepo.mostCompared(10),
      this.listItemRepo.countPerListName(),
      this.savedCollegeModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).exec(),
    ]);

    const allCollegeIds = Array.from(new Set([
      ...mostSavedRaw.map(r => r._id), ...trendingRaw.map(r => r._id), ...mostComparedRaw.map(r => r._id),
    ]));
    const colleges = allCollegeIds.length > 0 ? await this.collegeRepo.findByIds(allCollegeIds) : [];
    const nameById = new Map(colleges.map(c => [c.id, c.name]));

    return {
      mostSaved: mostSavedRaw.map(r => ({ collegeId: r._id, collegeName: nameById.get(r._id) ?? 'Unknown college', saves: r.saves })),
      trending: trendingRaw.map(r => ({ collegeId: r._id, collegeName: nameById.get(r._id) ?? 'Unknown college', savesLast7Days: r.savesLast7Days })),
      mostCompared: mostComparedRaw.map(r => ({ collegeId: r._id, collegeName: nameById.get(r._id) ?? 'Unknown college', comparisons: r.comparisons })),
      popularLists: popularLists.map((r: { _id: string; count: number }) => ({ name: r._id, count: r.count })),
      bookmarkStatusBreakdown: statusRaw.map(r => ({ status: r._id, count: r.count })),
    };
  }
}
