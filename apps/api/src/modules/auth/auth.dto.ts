import {
  IsBoolean, IsEmail, IsIn, IsJWT, IsOptional, IsString,
  Length, Matches, MaxLength, MinLength,
} from 'class-validator';
import { Match } from '../../common/validators/match.decorator';

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PASSWORD_POLICY_MESSAGE = 'Password must include an uppercase letter, a lowercase letter, and a number.';

export const OAUTH_PROVIDERS = ['google', 'microsoft', 'github', 'apple', 'linkedin'] as const;
export type OAuthProvider = typeof OAUTH_PROVIDERS[number];

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) @MaxLength(64) password: string;
}

export class RefreshTokenDto {
  @IsJWT() refreshToken: string;
}

export class AdminLogoutDto {
  @IsOptional() @IsJWT() refreshToken?: string;
}

export class ForgotPasswordDto {
  @IsEmail() email: string;
}

export class ResetPasswordDto {
  @IsEmail() email: string;
  @IsString() @Length(64, 64) token: string;
  @IsString() @MinLength(8) @MaxLength(64) newPassword: string;
}

export class OAuthLoginDto {
  @IsIn(OAUTH_PROVIDERS) provider: OAuthProvider;
  @IsString() idTokenTokenOrCode: string;
  @IsOptional() @IsString() providerId?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() avatarUrl?: string;
}

export class OAuthCallbackDto {
  @IsIn(OAUTH_PROVIDERS) provider: OAuthProvider;
  @IsString() code: string;
  @IsOptional() @IsString() state?: string;
}

// ── Student email/password auth ─────────────────────────────────────────────

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(80) fullName: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) @MaxLength(64) @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  password: string;
  @IsString() @Match('password', { message: 'Passwords do not match.' })
  confirmPassword: string;
  @IsBoolean() @IsIn([true], { message: 'You must accept the Terms of Service and Privacy Policy.' })
  acceptTerms: boolean;
  @IsOptional() @IsBoolean() newsletterOptIn?: boolean;
}

export class StudentLoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(1) @MaxLength(64) password: string;
  @IsOptional() @IsBoolean() rememberMe?: boolean;
}

export class StudentRefreshTokenDto {
  @IsJWT() refreshToken: string;
}

export class StudentLogoutDto {
  @IsOptional() @IsJWT() refreshToken?: string;
}

export class RevokeSessionDto {
  @IsString() sessionId: string;
}

export class StudentForgotPasswordDto {
  @IsEmail() email: string;
}

export class StudentResetPasswordDto {
  @IsEmail() email: string;
  @IsString() @Length(6, 6) otp: string;
  @IsString() @MinLength(8) @MaxLength(64) @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  newPassword: string;
}

export class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8) @MaxLength(64) @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  newPassword: string;
}
