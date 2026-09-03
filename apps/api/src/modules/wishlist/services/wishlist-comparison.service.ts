import { Injectable } from '@nestjs/common';
import { CollegeService } from '../../colleges/services/college.service';
import { CollegeRepository } from '../../colleges/repositories/college.repository';
import { WishlistEnrichmentService } from './wishlist-enrichment.service';
import { ComparisonSnapshotRepository } from '../repositories/comparison-snapshot.repository';
import { CompareLimitExceededException } from '../wishlist.exceptions';

@Injectable()
export class WishlistComparisonService {
  constructor(
    private readonly collegeService: CollegeService,
    private readonly collegeRepo: CollegeRepository,
    private readonly enrichment: WishlistEnrichmentService,
    private readonly snapshotRepo: ComparisonSnapshotRepository,
  ) {}

  /** Compares up to 4 saved colleges — NIRF/placements/fees/hostel/infra come
   * straight from CollegeService.compare (same base data College Explorer's
   * compare page uses); ROI/admission-probability are layered on from the
   * student's own saved predictions, not recomputed. Each call is recorded
   * as a ComparisonSnapshot for history + admin "Most Compared" analytics. */
  async compare(userId: string, collegeIds: string[], name?: string) {
    if (collegeIds.length < 2 || collegeIds.length > 4) throw new CompareLimitExceededException();
    const colleges = await this.collegeService.compare({ collegeIds });
    const enrichmentByCollege = await this.enrichment.enrichMany(userId, colleges);

    await this.snapshotRepo.record(userId, colleges.map(c => c.id), name);

    return colleges.map(college => ({ college, enrichment: enrichmentByCollege.get(college.id)! }));
  }

  async listHistory(userId: string) {
    const snapshots = await this.snapshotRepo.list(userId);
    const allIds = Array.from(new Set(snapshots.flatMap(s => s.collegeIds)));
    const colleges = await this.collegeRepo.findByIds(allIds);
    const nameById = new Map(colleges.map(c => [c.id, c.name]));
    return snapshots.map(s => ({
      id: s.id,
      name: s.name ?? null,
      createdAt: (s as unknown as { createdAt: Date }).createdAt,
      collegeIds: s.collegeIds,
      collegeNames: s.collegeIds.map(id => nameById.get(id) ?? 'Unknown college'),
    }));
  }
}
