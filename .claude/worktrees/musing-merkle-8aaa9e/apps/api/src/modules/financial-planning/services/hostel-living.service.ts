import { Injectable } from '@nestjs/common';
import { CollegeService } from '../../colleges/services/college.service';
import { HostelLivingRequestDto } from '../dto/hostel-living.dto';
import { estimateLivingCost, LivingCostBreakdown } from '../utils/living-cost.util';

export interface DbHostelInfo {
  boysHostel: boolean;
  girlsHostel: boolean;
  capacity: number;
  roomTypes: string[];
  messDetails: string;
  amenities: string[];
  hostelFeePerYear: number;
  messFeePerYear: number;
}

export interface HostelLivingResult {
  /** Real DB-sourced hostel info + fees, present only when collegeId is given and the college has hostelInfo on file. */
  dbHostelInfo: DbHostelInfo | null;
  /** City-tier estimate for whichever non-DB-tracked items apply (electricity, internet, laundry, food, personal, transport, medical). */
  estimate: LivingCostBreakdown;
}

@Injectable()
export class HostelLivingService {
  constructor(private readonly collegeService: CollegeService) {}

  async getHostelLivingEstimate(dto: HostelLivingRequestDto): Promise<HostelLivingResult> {
    let dbHostelInfo: DbHostelInfo | null = null;
    let city = dto.city;

    if (dto.collegeId) {
      const college = await this.collegeService.getDetail(dto.collegeId);
      city = college.city;
      const hostelInfo = (college as any).hostelInfo;
      const feeBreakdown = (college as any).feeBreakdown;
      if (hostelInfo) {
        dbHostelInfo = {
          boysHostel: hostelInfo.boysHostel,
          girlsHostel: hostelInfo.girlsHostel,
          capacity: hostelInfo.capacity,
          roomTypes: hostelInfo.roomTypes ?? [],
          messDetails: hostelInfo.messDetails,
          amenities: hostelInfo.amenities ?? [],
          hostelFeePerYear: feeBreakdown?.hostelFee ?? 0,
          messFeePerYear: feeBreakdown?.messFee ?? 0,
        };
      }
    }

    const estimate = estimateLivingCost({
      city,
      accommodationType: dto.accommodationType,
      transportPreference: dto.transportPreference,
    });

    return { dbHostelInfo, estimate };
  }
}
