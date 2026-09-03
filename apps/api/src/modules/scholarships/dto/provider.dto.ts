import { IsEmail, IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

const PROVIDER_TYPES = ['government_central', 'government_state', 'private', 'institution', 'ngo', 'corporate'] as const;

export class CreateProviderDto {
  @IsString() name: string;
  @IsEnum(PROVIDER_TYPES) type: string;
  @IsOptional() @IsUrl() website?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateProviderDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(PROVIDER_TYPES) type?: string;
  @IsOptional() @IsUrl() website?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() description?: string;
}
