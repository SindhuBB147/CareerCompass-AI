import { Injectable } from '@nestjs/common';
import { RecentlyViewedRepository } from '../repositories/recently-viewed.repository';
import { CollegeRepository } from '../../colleges/repositories/college.repository';
import { CollegeDocument } from '../../colleges/models/college.model';

export interface RecentlyViewedView {
  collegeId: string;
  viewedAt: Date;
  college: CollegeDocument;
}

// Recorded from the frontend (college detail page mount) rather than from
// CollegeController server-side — keeps CollegesModule fully unaware of
// WishlistModule (WishlistModule already depends on CollegesModule; a
// write-back the other way would create a cycle). This also means history
// only tracks views by authenticated, opted-in students, which is the
// only case "Recently Viewed" needs to serve.
@Injectable()
export class RecentlyViewedService {
  constructor(
    private readonly repo: RecentlyViewedRepository,
    private readonly collegeRepo: CollegeRepository,
  ) {}

  record(userId: string, collegeId: string): Promise<void> {
    return this.repo.record(userId, collegeId);
  }

  async list(userId: string): Promise<RecentlyViewedView[]> {
    const rows = await this.repo.list(userId);
    if (rows.length === 0) return [];
    const colleges = await this.collegeRepo.findByIds(rows.map(r => r.collegeId));
    const collegeById = new Map(colleges.map(c => [c.id, c]));
    return rows
      .filter(r => collegeById.has(r.collegeId))
      .map(r => ({ collegeId: r.collegeId, viewedAt: r.viewedAt, college: collegeById.get(r.collegeId)! }));
  }

  clear(userId: string): Promise<unknown> {
    return this.repo.clear(userId);
  }
}
