import { Injectable } from '@nestjs/common';
import { ScholarshipService } from '../../scholarships/services/scholarship.service';
import { sumScholarshipSavings, ScholarshipSavingsResult } from '../utils/scholarship-award.util';

@Injectable()
export class ScholarshipSavingsService {
  constructor(private readonly scholarshipService: ScholarshipService) {}

  /**
   * Sums estimated scholarship savings for the given user against a fee
   * base (typically the tuition/academic fee total from the fee
   * breakdown). Returns a zeroed result for an unauthenticated caller
   * (no userId) rather than throwing — the fee breakdown/dashboard should
   * still render for anonymous "what-if" browsing.
   */
  async getEstimatedSavings(userId: string | undefined, feeBase: number): Promise<ScholarshipSavingsResult> {
    if (!userId) return { scholarships: [], totalEstimatedSavings: 0 };

    const matches = await this.scholarshipService.getMatched(userId);
    return sumScholarshipSavings(
      matches.map((s: any) => ({ name: s.name, awardAmount: s.awardAmount })),
      feeBase,
    );
  }
}
