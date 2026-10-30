import { IsBoolean, IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class InitiateTwoFactorSetupDto {
  @IsIn(['totp', 'email']) method: 'totp' | 'email';
}

export class ConfirmTwoFactorSetupDto {
  @IsString() @Length(4, 12) code: string;
}

export class DisableTwoFactorDto {
  @IsString() currentPassword: string;
}

export class VerifyTwoFactorDto {
  @IsString() pendingToken: string;
  @IsString() @Length(4, 12) code: string;
  @IsOptional() @IsBoolean() trustThisDevice?: boolean;
}

export class RenameDeviceDto {
  @IsString() @MinLength(1) @MaxLength(60) deviceName: string;
}

export class ReportUnknownLoginDto {
  @IsOptional() @IsString() note?: string;
}

export class ReauthDto {
  @IsString() currentPassword: string;
}

export class ForceLogoutDto {
  @IsIn(['student', 'admin']) actorType: 'student' | 'admin';
}

export class UpdateLockDto {
  @IsOptional() @IsString() reason?: string;
}
