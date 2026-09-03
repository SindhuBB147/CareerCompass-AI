import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AccommodationTypeDto, TransportPreferenceDto } from './fee-breakdown.dto';

const ACCOMMODATION_TYPES: AccommodationTypeDto[] = ['hostel', 'pg', 'apartment_shared', 'day_scholar'];
const TRANSPORT_PREFERENCES: TransportPreferenceDto[] = ['none', 'public', 'two_wheeler'];

export class HostelLivingRequestDto {
  @IsOptional() @IsString() collegeId?: string;
  @IsOptional() @IsString() city?: string;
  @IsEnum(ACCOMMODATION_TYPES) accommodationType: AccommodationTypeDto;
  @IsOptional() @IsEnum(TRANSPORT_PREFERENCES) transportPreference?: TransportPreferenceDto;
}
