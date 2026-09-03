import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { AccommodationTypeDto, TransportPreferenceDto } from './fee-breakdown.dto';

const ACCOMMODATION_TYPES: AccommodationTypeDto[] = ['hostel', 'pg', 'apartment_shared', 'day_scholar'];
const TRANSPORT_PREFERENCES: TransportPreferenceDto[] = ['none', 'public', 'two_wheeler'];

export class FinancialDashboardRequestDto {
  @IsString() collegeId: string;
  @IsString() courseId: string;
  @IsBoolean() hostelRequired: boolean;
  @IsOptional() @IsEnum(ACCOMMODATION_TYPES) accommodationType?: AccommodationTypeDto;
  @IsOptional() @IsEnum(TRANSPORT_PREFERENCES) transportPreference?: TransportPreferenceDto;
  @IsOptional() @IsBoolean() includeLaptop?: boolean;
  @IsOptional() @IsNumber() @Min(0) familyContribution?: number;
  @IsOptional() @IsNumber() @Min(0) currentSavings?: number;
}
