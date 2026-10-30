import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { SavedCollege, SavedCollegeDocument } from '../models/saved-college.model';
import { WishlistListItemRepository } from '../repositories/wishlist-list-item.repository';
import { ComparisonSnapshotRepository } from '../repositories/comparison-snapshot.repository';
import { SavedCollegeRepository } from '../repositories/saved-college.repository';
import { CollegeRepository } from '../../colleges/repositories/college.repository';
import { UserRepository } from '../../users/repositories/user.repository';

export interface WishlistAnalytics {
  mostSaved: Array<{ collegeId: string; collegeName: string; saves: number }>;
  trending: Array<{ collegeId: string; collegeName: string; savesLast7Days: number }>;
  mostCompared: Array<{ collegeId: string; collegeName: string; comparisons: number }>;
  popularLists: Array<{ name: string; count: number }>;
  bookmarkStatusBreakdown: Array<{ status: string; count: number }>;
}

export interface AdminSavedCollegeFilters {
  q?: string;
  status?: string;
  state?: string;
  district?: string;
  collegeType?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'newest' | 'oldest' | 'college_asc' | 'college_desc' | 'student_asc' | 'student_desc';
  page: number;
  limit: number;
}

export interface AdminSavedCollegeRow {
  id: string;
  userId: string;
  studentName: string;
  studentEmail: string | null;
  collegeId: string;
  collegeName: string;
  collegeCode: string | null;
  city: string | null;
  district: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class WishlistAnalyticsService {
  constructor(
    @InjectModel(SavedCollege.name) private readonly savedCollegeModel: Model<SavedCollegeDocument>,
    private readonly listItemRepo: WishlistListItemRepository,
    private readonly snapshotRepo: ComparisonSnapshotRepository,
    private readonly savedCollegeRepo: SavedCollegeRepository,
    private readonly collegeRepo: CollegeRepository,
    private readonly userRepo: UserRepository,
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

  /**
   * Admin per-record listing. SavedCollege only stores userId/collegeId, so
   * filters that touch student or college attributes (name/email/state/
   * district/type) are resolved to id sets first via the existing college
   * and user search, then applied in-memory alongside the enrichment join —
   * simpler and fast enough at this dataset's scale than a $lookup pipeline,
   * and reuses CollegeRepository.search/findByIds exactly as analytics does.
   */
  async listSavedColleges(filters: AdminSavedCollegeFilters): Promise<{ rows: AdminSavedCollegeRow[]; total: number }> {
    const mongoFilter: FilterQuery<SavedCollegeDocument> = {};
    if (filters.status) mongoFilter.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      mongoFilter.createdAt = {};
      if (filters.dateFrom) (mongoFilter.createdAt as any).$gte = new Date(filters.dateFrom);
      if (filters.dateTo) (mongoFilter.createdAt as any).$lte = new Date(filters.dateTo);
    }

    let allowedCollegeIds: Set<string> | null = null;
    if (filters.state || filters.district || filters.collegeType) {
      const { results } = await this.collegeRepo.search({
        state: filters.state, district: filters.district, collegeType: filters.collegeType,
        page: 1, limit: 5000, includeArchived: true,
      });
      allowedCollegeIds = new Set(results.map(c => c.id));
    }

    let allowedUserIds: Set<string> | null = null;
    let qCollegeIds: Set<string> | null = null;
    if (filters.q) {
      const [matchedUsers, collegeSearch] = await Promise.all([
        this.userRepo.searchByNameOrEmail(filters.q),
        this.collegeRepo.search({ q: filters.q, page: 1, limit: 500, includeArchived: true }),
      ]);
      allowedUserIds = new Set(matchedUsers.map(u => u.id));
      qCollegeIds = new Set(collegeSearch.results.map(c => c.id));
    }

    const records = await this.savedCollegeModel.find(mongoFilter).sort({ createdAt: -1 }).exec();

    let filtered = records;
    if (allowedCollegeIds) {
      const ids = allowedCollegeIds;
      filtered = filtered.filter(r => ids.has(r.collegeId));
    }
    if (filters.q) {
      const uIds = allowedUserIds!;
      const cIds = qCollegeIds!;
      filtered = filtered.filter(r => uIds.has(r.userId) || cIds.has(r.collegeId));
    }

    const collegeIds = Array.from(new Set(filtered.map(r => r.collegeId)));
    const userIds = Array.from(new Set(filtered.map(r => r.userId)));
    const [colleges, users] = await Promise.all([
      collegeIds.length ? this.collegeRepo.findByIds(collegeIds) : Promise.resolve([]),
      userIds.length ? this.userRepo.findByIds(userIds) : Promise.resolve([]),
    ]);
    const collegeById = new Map(colleges.map(c => [c.id, c]));
    const userById = new Map(users.map(u => [u.id, u]));

    const rows: AdminSavedCollegeRow[] = filtered.map(r => {
      const college = collegeById.get(r.collegeId);
      const user = userById.get(r.userId);
      const doc = r as unknown as { id: string; createdAt: Date; updatedAt: Date };
      return {
        id: doc.id,
        userId: r.userId,
        studentName: user?.fullName ?? 'Unknown student',
        studentEmail: user?.email ?? null,
        collegeId: r.collegeId,
        collegeName: college?.name ?? 'Unknown college',
        collegeCode: college?.collegeId ?? null,
        city: college?.city ?? null,
        district: college?.district ?? null,
        status: r.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    });

    switch (filters.sortBy) {
      case 'oldest': rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()); break;
      case 'college_asc': rows.sort((a, b) => a.collegeName.localeCompare(b.collegeName)); break;
      case 'college_desc': rows.sort((a, b) => b.collegeName.localeCompare(a.collegeName)); break;
      case 'student_asc': rows.sort((a, b) => a.studentName.localeCompare(b.studentName)); break;
      case 'student_desc': rows.sort((a, b) => b.studentName.localeCompare(a.studentName)); break;
      default: rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const total = rows.length;
    const start = (filters.page - 1) * filters.limit;
    return { rows: rows.slice(start, start + filters.limit), total };
  }

  async removeSavedCollege(userId: string, collegeId: string, adminId: string): Promise<void> {
    const existing = await this.savedCollegeRepo.find(userId, collegeId);
    if (!existing) throw new NotFoundException('Saved college record not found.');
    await this.savedCollegeRepo.remove(userId, collegeId);
    await this.collegeRepo.recordAudit({
      adminId,
      action: 'wishlist.admin_remove',
      targetCollection: 'wishlist',
      targetId: `${userId}:${collegeId}`,
      beforeSnapshot: { userId, collegeId, status: existing.status },
    });
  }
}
