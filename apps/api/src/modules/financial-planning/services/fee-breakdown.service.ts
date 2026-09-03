import { Injectable } from '@nestjs/common';
import { CollegeService } from '../../colleges/services/college.service';
import { CourseNotFoundException } from '../../colleges/colleges.exceptions';
import { FeeBreakdownRequestDto } from '../dto/fee-breakdown.dto';
import { decomposeFeeIntoLineItems, ProgramFeeBreakdown } from '../utils/fee-breakdown.util';
import { estimateLivingCost } from '../utils/living-cost.util';

@Injectable()
export class FeeBreakdownService {
  constructor(private readonly collegeService: CollegeService) {}

  async getFeeBreakdown(dto: FeeBreakdownRequestDto): Promise<ProgramFeeBreakdown> {
    const college = await this.collegeService.getDetail(dto.collegeId);
    const course = college.courses.find((c: any) => c.courseId === dto.courseId.toUpperCase());
    if (!course) throw new CourseNotFoundException();

    const academicFeePerYear = course.feePerYear ?? (college as any).feeBreakdown?.tuitionFee ?? 0;
    const hostelFeePerYear = (college as any).feeBreakdown?.hostelFee ?? 0;
    const messFeePerYear = (college as any).feeBreakdown?.messFee ?? 0;
    const otherChargesPerYear = (college as any).feeBreakdown?.otherCharges ?? 0;

    const livingCostNonHostelPerYear = dto.hostelRequired
      ? 0
      : estimateLivingCost({
          city: college.city,
          accommodationType: dto.accommodationType ?? 'day_scholar',
          transportPreference: dto.transportPreference,
        }).totalAnnual;

    return decomposeFeeIntoLineItems({
      academicFeePerYear,
      hostelFeePerYear,
      messFeePerYear,
      otherChargesPerYear,
      durationYears: course.durationYears,
      isHosteller: dto.hostelRequired,
      livingCostNonHostelPerYear,
      includeLaptop: dto.includeLaptop,
    });
  }
}
