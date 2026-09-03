import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface AccessTokenPayload { sub: string; email: string; role: string; }
export interface RefreshTokenPayload { sub: string; tokenId: string; }
export interface PendingTwoFactorPayload { sub: string; actorType: 'student' | 'admin'; purpose: '2fa_pending'; }
export interface ReauthTokenPayload { sub: string; purpose: 'reauth'; }

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  generateAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET') || 'default-access-secret-key-change-in-production-min-32-chars',
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRY') ?? '15m',
      algorithm: 'HS256',
    });
  }

  generateRefreshToken(payload: RefreshTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET') || 'default-refresh-secret-key-change-in-production-min-32-chars',
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRY') ?? '7d',
      algorithm: 'HS256',
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwtService.verify(token, {
      secret: this.config.get('JWT_ACCESS_SECRET') || 'default-access-secret-key-change-in-production-min-32-chars',
      algorithms: ['HS256'],
    });
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.jwtService.verify(token, {
      secret: this.config.get('JWT_REFRESH_SECRET') || 'default-refresh-secret-key-change-in-production-min-32-chars',
      algorithms: ['HS256'],
    });
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateOpaqueToken(): { rawToken: string; hash: string } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    return { rawToken, hash: this.hashToken(rawToken) };
  }

  generateTokenId(): string { return crypto.randomUUID(); }

  /** Short-lived, single-purpose token issued after password verification
   * when 2FA is enabled — NOT a real access token (no `role`/API scope), it
   * only unlocks POST /auth/2fa/verify for this one login attempt. */
  generatePendingTwoFactorToken(payload: Omit<PendingTwoFactorPayload, 'purpose'>): string {
    return this.jwtService.sign({ ...payload, purpose: '2fa_pending' }, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET') || 'default-access-secret-key-change-in-production-min-32-chars',
      expiresIn: '5m',
      algorithm: 'HS256',
    });
  }

  verifyPendingTwoFactorToken(token: string): PendingTwoFactorPayload {
    return this.jwtService.verify(token, {
      secret: this.config.get('JWT_ACCESS_SECRET') || 'default-access-secret-key-change-in-production-min-32-chars',
      algorithms: ['HS256'],
    });
  }

  /** Step-up token proving a very recent password re-entry, required by
   * @RequireReauth() routes for high-risk admin actions. */
  generateReauthToken(sub: string, ttlMinutes: number): string {
    return this.jwtService.sign({ sub, purpose: 'reauth' } as Omit<ReauthTokenPayload, never>, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET') || 'default-access-secret-key-change-in-production-min-32-chars',
      expiresIn: `${ttlMinutes}m`,
      algorithm: 'HS256',
    });
  }

  verifyReauthToken(token: string): ReauthTokenPayload {
    return this.jwtService.verify(token, {
      secret: this.config.get('JWT_ACCESS_SECRET') || 'default-access-secret-key-change-in-production-min-32-chars',
      algorithms: ['HS256'],
    });
  }

  /** 6-digit numeric OTP (e.g. password reset codes emailed to students). */
  generateOtpCode(): { code: string; hash: string } {
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    return { code, hash: this.hashToken(code) };
  }
}
