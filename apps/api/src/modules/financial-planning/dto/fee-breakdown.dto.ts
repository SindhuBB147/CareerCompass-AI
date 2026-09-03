import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export type AccommodationTypeDto = 'hostel' | 'pg' | 'apartment_shared' | 'day_scholar';
export type TransportPreferenceDto = 'none' | 'public' | 'two_wheeler';

const ACCOMMODATION_TYPES: AccommodationTypeDto[] = ['hostel', 'pg', 'apartment_shared', 'day_scholar'];
const TRANSPORT_PREFERENCES: TransportPreferenceDto[] = ['none', 'public', 'two_wheeler'];

export class FeeBreakdownRequestDto {
  @IsString() collegeId: string;
  @IsString() courseId: string;
  @IsBoolean() hostelRequired: boolean;
  @IsOptional() @IsEnum(ACCOMMODATION_TYPES) accommodationType?: AccommodationTypeDto;
  @IsOptional() @IsEnum(TRANSPORT_PREFERENCES) transportPreference?: TransportPreferenceDto;
  @IsOptional() @IsBoolean() includeLaptop?: boolean;
}
