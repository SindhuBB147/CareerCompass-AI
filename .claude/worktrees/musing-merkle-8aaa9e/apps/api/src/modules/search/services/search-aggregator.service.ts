import { Injectable, Logger } from '@nestjs/common';
import { CollegeRepository, CollegeSearchFilters } from '../../colleges/repositories/college.repository';
import { CollegeDocument } from '../../colleges/models/college.model';
import { ScholarshipService } from '../../scholarships/services/scholarship.service';
import { ScholarshipSearchFilters } from '../../scholarships/repositories/scholarship.repository';
import { ScholarshipDocument } from '../../scholarships/models/scholarship.model';
import { SearchEntities } from '../../../common/ai-client/ai-service.client';
import { StudentContext } from '../../../common/utils/student-context.util';
import { SearchFiltersDto } from '../dto/search.dto';

/**
 * Maps Smart Search's extracted entities + user-chosen filters onto the
 * *existing*, already-indexed repository/service query methods — no new
 * Mongo query surface. Entity extraction is what keeps this on the fast,
 * indexed path (state/collegeType/nirfRank/examsAccepted all have indexes,
 * see college.model.ts) instead of falling back to the free-text regex scan
 * CollegeSearchBar's own autosuggest still relies on (left untouched here).
 */
@Injectable()
export class SearchAggregatorService {
  private readonly logger = new Logger('SearchAggregatorService');

  constructor(
    private readonly collegeRepo: CollegeRepository,
    private readonly scholarshipService: ScholarshipService,
  ) {}

  async findCandidateColleges(
    entities: SearchEntities,
    filters: SearchFiltersDto | undefined,
    studentContext: StudentContext,
    limit = 30,
  ): Promise<CollegeDocument[]> {
    const searchFilters: CollegeSearchFilters = {
      city: filters?.city ?? entities.city ?? undefined,
      district: filters?.district,
      collegeType: filters?.collegeType ?? entities.college_type ?? undefined,
      branch: filters?.branch,
      discipline: filters?.discipline ?? entities.discipline ?? undefined,
      examCode: filters?.examCode ?? entities.exam ?? studentContext.examCode,
      minFee: filters?.minFee,
      maxFee: filters?.maxFee ?? entities.budget_max ?? undefined,
      maxNirf: filters?.maxNirf ?? entities.nirf_max ?? undefined,
      naac: filters?.naac,
      nbaOnly: filters?.nbaOnly,
      aicteApproved: filters?.aicteApproved,
      hostelAvailable: filters?.hostelAvailable || entities.hostel_required || undefined,
      page: 1,
      limit,
    };
    const { results } = await this.collegeRepo.search(searchFilters);
    return results;
  }

  /** Resolves compare-intent college name mentions against the corpus — v1 exact/near-match only (see rag/search_entities.py). */
  async findCompareTargets(collegeNames: string[]): Promise<CollegeDocument[]> {
    const found: CollegeDocument[] = [];
    for (const name of collegeNames) {
      try {
        const { results } = await this.collegeRepo.search({ q: name, page: 1, limit: 1 });
        if (results[0]) found.push(results[0]);
      } catch (err) {
        this.logger.warn(`Compare lookup failed for "${name}": ${(err as Error).message}`);
      }
    }
    return found;
  }

  async findScholarships(
    entities: SearchEntities,
    studentContext: StudentContext,
    limit = 10,
  ): Promise<ScholarshipDocument[]> {
    const filters: ScholarshipSearchFilters = {
      category: entities.category ?? studentContext.category,
      exam: entities.exam ?? studentContext.examCode,
      status: 'open',
      isActive: true,
      sortBy: 'deadline',
    };
    const { scholarships } = await this.scholarshipService.search(filters, 1, limit);
    return scholarships;
  }

  async getPopularColleges(limit = 6): Promise<CollegeDocument[]> {
    const { results } = await this.collegeRepo.search({ sortBy: 'nirf', page: 1, limit });
    return results;
  }

  async getPopularCourses(limit = 8): Promise<string[]> {
    const facets = await this.collegeRepo.getFacets();
    return facets.branches.slice(0, limit);
  }
}
