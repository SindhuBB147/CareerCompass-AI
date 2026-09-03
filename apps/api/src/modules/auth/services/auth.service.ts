import { Injectable, OnModuleInit } from '@nestjs/common';
import { AdminUserDocument } from '../models/admin-user.model';
import { AdminUserRepository } from '../repositories/admin-user.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { UserDocument, LinkedAccountProvider } from '../../users/models/user.model';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import { OtpTokenRepository } from '../repositories/otp-token.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { LoginRateLimiterService } from './login-rate-limiter.service';
import { minutesFromNow } from '../../../common/utils/date.util';
import {
  AccountInactiveException,
  DuplicateEmailException,
  InvalidCredentialsException,
  InvalidOtpException,
  InvalidRefreshTokenException,
  InvalidResetTokenException,
  TooManyOtpAttemptsException,
} from '../auth.exceptions';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailerService } from '../../../common/mailer/mailer.service';
import { NOTIFICATION_EVENTS } from '../../notifications/events/notification.events';
import { SECURITY_EVENTS } from '../../security/events/security.events';
import { fingerprintDevice } from '../../security/utils/crypto.util';
import { AccountLockedException, PasswordReusedException } from '../../security/security.exceptions';

export interface AuthTokens { accessToken: string; refreshToken: string; expiresIn: number; }
export interface StudentAuthTokens extends AuthTokens { sessionId: string; }
export interface AdminAuthTokens extends AuthTokens { sessionId: string; }
export interface RequestContext { ip?: string; userAgent?: string; }
export type SecurityActorType = 'student' | 'admin';

export interface TwoFactorChallenge {
  requires2FA: true;
  pendingToken: string;
  method: 'totp' | 'email';
}

export interface PublicStudent {
  id: string;
  email?: string;
  phone?: string;
  name: string;
  avatarUrl?: string;
  provider: string;
  role: 'student';
  isEmailVerified: boolean;
  onboardingCompleted: boolean;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly adminUserRepo: AdminUserRepository,
    private readonly userRepo: UserRepository,
    private readonly resetTokenRepo: PasswordResetTokenRepository,
    private readonly otpTokenRepo: OtpTokenRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly rateLimiter: LoginRateLimiterService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
    private readonly events: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.seedDefaultAdminIfEmpty();
  }

  private async seedDefaultAdminIfEmpty() {
    try {
      const count = await this.adminUserRepo.countAll();
      if (count === 0) {
        const email = 'admin@careercompass.ai';
        const password = 'AdminPassword123!';
        const passwordHash = await this.passwordService.hash(password);
        await this.adminUserRepo.create({
          email,
          passwordHash,
          role: 'super_admin',
          fullName: 'System Administrator',
          isActive: true,
        });
        console.log(`Seeded default super_admin account: ${email} / ${password}`);
      }
    } catch (err) {
      console.error('Failed to seed default admin:', (err as any).message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Admin auth (unchanged behavior — /auth/login, /auth/refresh, /auth/logout)
  // ═══════════════════════════════════════════════════════════════════════

  async login(email: string, password: string, ctx: RequestContext): Promise<{ tokens: AdminAuthTokens; role: string } | TwoFactorChallenge> {
    const ip = ctx.ip ?? 'unknown';
    this.rateLimiter.checkAndThrow(email, ip);

    const user = await this.adminUserRepo.findByEmail(email);

    if (!user) {
      // Timing-attack mitigation: pay the full bcrypt cost even for unknown emails.
      await this.passwordService.dummyCompare(password);
      this.rateLimiter.recordFailure(email, ip);
      throw new InvalidCredentialsException();
    }

    this.assertNotLocked(user.lockedUntil);
    if (!user.isActive) throw new AccountInactiveException();

    const matches = await this.passwordService.compare(password, user.passwordHash);
    if (!matches) {
      this.rateLimiter.recordFailure(email, ip);
      await this.registerFailedAttempt(this.adminUserRepo, user.id, 'admin', ctx);
      throw new InvalidCredentialsException();
    }

    this.rateLimiter.recordSuccess(email, ip);
    await this.adminUserRepo.resetFailedLoginCount(user.id);

    if (user.twoFactorEnabled && !this.isDeviceRemembered(user.twoFactorTrustedDeviceFingerprints, ctx)) {
      return this.issueTwoFactorChallenge(user.id, 'admin', user.twoFactorMethod, user.email);
    }

    const tokens = await this.issueAdminTokenPair(user, ctx, 'password');
    return { tokens, role: user.role };
  }

  async refreshTokens(refreshToken: string): Promise<AdminAuthTokens> {
    let payload;
    try { payload = this.tokenService.verifyRefreshToken(refreshToken); }
    catch { throw new InvalidRefreshTokenException(); }

    const user = await this.adminUserRepo.findById(payload.sub);
    if (!user?.isActive) throw new InvalidRefreshTokenException();

    const session = user.sessions.find(s => s.sessionId === payload.tokenId);
    if (!session || session.refreshTokenHash !== this.tokenService.hashToken(refreshToken)) {
      // Refresh token reuse/mismatch — revoke that one session, not every
      // device (mirrors studentRefreshTokens's handling).
      if (session) await this.adminUserRepo.revokeSession(user.id, payload.tokenId);
      throw new InvalidRefreshTokenException();
    }

    const newAccessToken = this.tokenService.generateAccessToken({ sub: user.id, email: user.email, role: user.role });
    const newRefreshToken = this.tokenService.generateRefreshToken({ sub: user.id, tokenId: payload.tokenId });
    await this.adminUserRepo.rotateSession(user.id, payload.tokenId, this.tokenService.hashToken(newRefreshToken));

    return { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 900, sessionId: payload.tokenId };
  }

  /** Revokes one session (the one tied to `refreshToken`) when provided —
   * mirrors studentLogout. Falls back to revoking every admin session when
   * no refresh token is given, preserving the pre-multi-session behavior of
   * "logout always clears everything" for any caller that doesn't send one. */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      await this.adminUserRepo.revokeAllSessions(userId);
      return;
    }
    try {
      const payload = this.tokenService.verifyRefreshToken(refreshToken);
      await this.adminUserRepo.revokeSession(userId, payload.tokenId);
    } catch {
      // Already invalid/expired — nothing to revoke.
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.adminUserRepo.revokeAllSessions(userId);
  }

  /** Non-enumerating: always responds "if that email is registered, a code was sent." */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.adminUserRepo.findByEmail(email);
    if (!user) return;

    const { rawToken, hash } = this.tokenService.generateOpaqueToken();
    const expiryMins = this.config.get<number>('PASSWORD_RESET_TOKEN_EXPIRY_MINUTES') ?? 30;
    await this.resetTokenRepo.create(user.id, hash, minutesFromNow(expiryMins));
    await this.sendResetEmail(user.email, rawToken, expiryMins);
  }

  async resetPassword(email: string, rawToken: string, newPassword: string): Promise<void> {
    const user = await this.adminUserRepo.findByEmail(email);
    const hash = this.tokenService.hashToken(rawToken);

    // Timing-parity: always do the DB lookup even when user is not found.
    const tokenId = user ? user.id : 'nonexistent';
    const tokenRecord = await this.resetTokenRepo.findValid(tokenId, hash);

    if (!user || !tokenRecord) throw new InvalidResetTokenException();
    await this.assertPasswordNotReused(newPassword, user.passwordHistory);

    const newHash = await this.passwordService.hash(newPassword);
    await this.adminUserRepo.updatePasswordAndRevokeSessions(user.id, newHash);
    await this.resetTokenRepo.markUsed(tokenRecord.id);
    await this.resetTokenRepo.invalidateAll(user.id);
  }

  private async issueAdminTokenPair(user: AdminUserDocument, ctx: RequestContext, loginMethod: string): Promise<AdminAuthTokens> {
    const sessionId = this.tokenService.generateTokenId();
    const accessToken = this.tokenService.generateAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = this.tokenService.generateRefreshToken({ sub: user.id, tokenId: sessionId });
    const refreshHash = this.tokenService.hashToken(refreshToken);

    await this.adminUserRepo.addSession(user.id, { sessionId, refreshTokenHash: refreshHash, userAgent: ctx.userAgent, ip: ctx.ip });
    this.events.emit(SECURITY_EVENTS.LOGIN_ATTEMPT, {
      userId: user.id, actorType: 'admin', ip: ctx.ip, userAgent: ctx.userAgent, loginMethod, status: 'success',
    });

    return { accessToken, refreshToken, expiresIn: 900, sessionId };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Student auth — email/password, OAuth, multi-device sessions
  // ═══════════════════════════════════════════════════════════════════════

  async registerStudent(
    dto: { fullName: string; email: string; password: string; newsletterOptIn?: boolean },
    ctx: RequestContext,
  ): Promise<{ tokens: StudentAuthTokens; user: PublicStudent }> {
    this.rateLimiter.checkAndThrow(dto.email, ctx.ip ?? 'unknown');

    const email = dto.email.toLowerCase();
    const existing = await this.userRepo.findByEmail(email);
    const passwordHash = await this.passwordService.hash(dto.password);

    let user: UserDocument;
    if (existing) {
      // Existing OAuth-only account with no local password — add password
      // login as another way in, rather than rejecting or duplicating.
      if (existing.passwordHash) {
        this.rateLimiter.recordFailure(dto.email, ctx.ip ?? 'unknown');
        throw new DuplicateEmailException();
      }
      const updated = await this.userRepo.setPasswordHash(existing.id, passwordHash);
      user = updated ?? existing;
    } else {
      user = await this.userRepo.create({
        fullName: dto.fullName,
        email,
        passwordHash,
        authProvider: 'password',
        isEmailVerified: false,
        notificationChannels: { email: dto.newsletterOptIn ?? false, sms: true, whatsapp: false, push: false } as any,
      });
      this.events.emit(NOTIFICATION_EVENTS.USER_REGISTERED, { userId: user.id, fullName: user.fullName });
    }

    this.rateLimiter.recordSuccess(dto.email, ctx.ip ?? 'unknown');
    const tokens = await this.issueStudentTokens(user, ctx, 'register');
    return { tokens, user: this.toPublicStudent(user) };
  }

  async studentLogin(email: string, password: string, ctx: RequestContext): Promise<{ tokens: StudentAuthTokens; user: PublicStudent } | TwoFactorChallenge> {
    this.rateLimiter.checkAndThrow(email, ctx.ip ?? 'unknown');

    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.passwordHash) {
      await this.passwordService.dummyCompare(password);
      this.rateLimiter.recordFailure(email, ctx.ip ?? 'unknown');
      throw new InvalidCredentialsException();
    }

    this.assertNotLocked(user.lockedUntil);
    if (user.accountStatus !== 'active') throw new AccountInactiveException();

    const matches = await this.passwordService.compare(password, user.passwordHash);
    if (!matches) {
      this.rateLimiter.recordFailure(email, ctx.ip ?? 'unknown');
      await this.registerFailedAttempt(this.userRepo, user.id, 'student', ctx);
      throw new InvalidCredentialsException();
    }

    this.rateLimiter.recordSuccess(email, ctx.ip ?? 'unknown');
    await this.userRepo.resetFailedLoginCount(user.id);

    if (user.twoFactorEnabled && !this.isDeviceRemembered(user.twoFactorTrustedDeviceFingerprints, ctx)) {
      return this.issueTwoFactorChallenge(user.id, 'student', user.twoFactorMethod, user.email);
    }

    const tokens = await this.issueStudentTokens(user, ctx, 'password');
    return { tokens, user: this.toPublicStudent(user) };
  }

  /** Completes a login that was paused for a 2FA challenge — called by
   * TwoFactorLoginController (modules/security) after it verifies the code
   * via TwoFactorService. Lives here (not in the security module) because
   * only AuthService can mint real access/refresh tokens. */
  async completeTwoFactorLogin(userId: string, actorType: SecurityActorType, ctx: RequestContext): Promise<{ tokens: StudentAuthTokens; user: PublicStudent } | { tokens: AdminAuthTokens; role: string }> {
    if (actorType === 'student') {
      const user = await this.userRepo.findById(userId);
      if (!user || user.accountStatus !== 'active') throw new InvalidCredentialsException();
      const tokens = await this.issueStudentTokens(user, ctx, '2fa');
      return { tokens, user: this.toPublicStudent(user) };
    }

    const admin = await this.adminUserRepo.findById(userId);
    if (!admin?.isActive) throw new InvalidCredentialsException();
    const tokens = await this.issueAdminTokenPair(admin, ctx, '2fa');
    return { tokens, role: admin.role };
  }

  async studentRefreshTokens(refreshToken: string): Promise<StudentAuthTokens> {
    let payload;
    try { payload = this.tokenService.verifyRefreshToken(refreshToken); }
    catch { throw new InvalidRefreshTokenException(); }

    const user = await this.userRepo.findById(payload.sub);
    if (!user || user.accountStatus !== 'active') throw new InvalidRefreshTokenException();

    const session = user.sessions.find(s => s.sessionId === payload.tokenId);
    if (!session || session.refreshTokenHash !== this.tokenService.hashToken(refreshToken)) {
      // Refresh token reuse/mismatch — revoke that one session (not every
      // device) so a stolen-then-replayed token can't keep working, without
      // logging out the student's other legitimate sessions.
      if (session) await this.userRepo.revokeSession(user.id, payload.tokenId);
      throw new InvalidRefreshTokenException();
    }

    const newAccessToken = this.tokenService.generateAccessToken({ sub: user.id, email: user.email ?? '', role: 'student' });
    const newRefreshToken = this.tokenService.generateRefreshToken({ sub: user.id, tokenId: payload.tokenId });
    await this.userRepo.rotateSession(user.id, payload.tokenId, this.tokenService.hashToken(newRefreshToken));

    return { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 900, sessionId: payload.tokenId };
  }

  async studentLogout(userId: string, refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = this.tokenService.verifyRefreshToken(refreshToken);
      await this.userRepo.revokeSession(userId, payload.tokenId);
    } catch {
      // Already invalid/expired — nothing to revoke.
    }
  }

  async studentLogoutAll(userId: string): Promise<void> {
    await this.userRepo.revokeAllSessions(userId);
  }

  async listStudentSessions(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) return [];
    return user.sessions.map(s => ({
      sessionId: s.sessionId,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
    }));
  }

  async revokeStudentSession(userId: string, sessionId: string): Promise<void> {
    await this.userRepo.revokeSession(userId, sessionId);
  }

  /** Authenticated password change — requires the current password, then
   * revokes every session (this one included) so the new password is the
   * only way back in, on every device. */
  async changePasswordStudent(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsException();
    }
    const matches = await this.passwordService.compare(currentPassword, user.passwordHash);
    if (!matches) throw new InvalidCredentialsException();
    await this.assertPasswordNotReused(newPassword, user.passwordHistory);

    const newHash = await this.passwordService.hash(newPassword);
    await this.userRepo.setPasswordHash(user.id, newHash);
    await this.userRepo.revokeAllSessions(user.id);
    this.events.emit(NOTIFICATION_EVENTS.AUTH_PASSWORD_CHANGED, { userId: user.id });
  }

  /** Non-enumerating: always responds "if that email is registered, a code was sent." */
  async forgotPasswordStudent(email: string, ip = 'unknown'): Promise<void> {
    this.rateLimiter.checkAndThrow(email, ip);
    const user = await this.userRepo.findByEmail(email);
    if (!user) return;

    await this.otpTokenRepo.invalidateAll(user.id, 'password_reset');
    const { code, hash } = this.tokenService.generateOtpCode();
    const expiryMins = this.config.get<number>('OTP_EXPIRY_MINUTES') ?? 10;
    await this.otpTokenRepo.create(user.id, 'password_reset', hash, minutesFromNow(expiryMins));
    await this.sendOtpEmail(user.email!, code, expiryMins);
  }

  async resetPasswordStudent(email: string, otp: string, newPassword: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    const userId = user ? user.id : 'nonexistent';

    const record = await this.otpTokenRepo.findActive(userId, 'password_reset');
    if (!user || !record) throw new InvalidOtpException();

    if (record.attempts >= 5) throw new TooManyOtpAttemptsException();

    const matches = record.codeHash === this.tokenService.hashToken(otp);
    if (!matches) {
      await this.otpTokenRepo.incrementAttempts(record.id);
      throw new InvalidOtpException();
    }
    await this.assertPasswordNotReused(newPassword, user.passwordHistory);

    const newHash = await this.passwordService.hash(newPassword);
    await this.userRepo.setPasswordHash(user.id, newHash);
    await this.userRepo.revokeAllSessions(user.id); // force re-login on every device
    await this.otpTokenRepo.markUsed(record.id);
    await this.otpTokenRepo.invalidateAll(user.id, 'password_reset');
    this.events.emit(NOTIFICATION_EVENTS.AUTH_PASSWORD_CHANGED, { userId: user.id });
  }

  /**
   * OAuth login/registration for Google, Microsoft, GitHub, Apple, LinkedIn.
   * If the provider's email already exists on the platform (password
   * signup, or a different linked provider), the account is linked instead
   * of creating a duplicate student record — the provider vouches for the
   * email's ownership, so the link (and email-verified flag) is applied
   * immediately, no extra verification step needed.
   */
  async loginWithOAuth(
    dto: { provider: LinkedAccountProvider; idTokenTokenOrCode: string; providerId?: string; email?: string; name?: string; avatarUrl?: string },
    ctx: RequestContext = {},
  ): Promise<{ tokens: StudentAuthTokens; user: PublicStudent }> {
    const email = (dto.email || `oauth_${dto.provider}_${Date.now()}@user.careercompass.ai`).toLowerCase();
    const name = dto.name || `${dto.provider.charAt(0).toUpperCase()}${dto.provider.slice(1)} User`;
    const providerId = dto.providerId || dto.idTokenTokenOrCode;

    let user = providerId ? await this.userRepo.findByLinkedAccount(dto.provider, providerId) : null;
    if (!user) user = await this.userRepo.findByEmail(email);

    if (!user) {
      user = await this.userRepo.create({
        email,
        fullName: name,
        isEmailVerified: true,
        authProvider: dto.provider,
        accountStatus: 'active',
        linkedAccounts: [{ provider: dto.provider, providerId, email, linkedAt: new Date() }],
      } as any);
      this.events.emit(NOTIFICATION_EVENTS.USER_REGISTERED, { userId: user.id, fullName: user.fullName });
    } else {
      const alreadyLinked = user.linkedAccounts.some(a => a.provider === dto.provider);
      if (!alreadyLinked) {
        const updated = await this.userRepo.linkAccount(user.id, { provider: dto.provider, providerId, email });
        if (updated) user = updated;
        if (!user.isEmailVerified) {
          await this.userRepo.markEmailVerified(user.id);
          this.events.emit(NOTIFICATION_EVENTS.AUTH_EMAIL_VERIFIED, { userId: user.id });
        }
      }
    }

    if (user.accountStatus !== 'active') throw new AccountInactiveException();

    const tokens = await this.issueStudentTokens(user, ctx, `oauth_${dto.provider}`);
    return {
      tokens,
      user: { ...this.toPublicStudent(user), avatarUrl: dto.avatarUrl, provider: dto.provider },
    };
  }

  private async issueStudentTokens(user: UserDocument, ctx: RequestContext, loginMethod: string): Promise<StudentAuthTokens> {
    const sessionId = this.tokenService.generateTokenId();
    const accessToken = this.tokenService.generateAccessToken({ sub: user.id, email: user.email ?? '', role: 'student' });
    const refreshToken = this.tokenService.generateRefreshToken({ sub: user.id, tokenId: sessionId });
    const refreshHash = this.tokenService.hashToken(refreshToken);

    // "New device" heuristic: no prior session shares this user-agent. Read
    // before addSession() so a brand-new account's first-ever login isn't
    // misreported as a new device.
    const isNewDevice = !!ctx.userAgent && user.sessions.length > 0 && !user.sessions.some(s => s.userAgent === ctx.userAgent);

    await this.userRepo.addSession(user.id, {
      sessionId,
      refreshTokenHash: refreshHash,
      userAgent: ctx.userAgent,
      ip: ctx.ip,
    });

    if (isNewDevice) {
      this.events.emit(NOTIFICATION_EVENTS.AUTH_NEW_DEVICE, { userId: user.id, ip: ctx.ip, userAgent: ctx.userAgent });
    }
    this.events.emit(SECURITY_EVENTS.LOGIN_ATTEMPT, {
      userId: user.id, actorType: 'student', ip: ctx.ip, userAgent: ctx.userAgent, loginMethod, status: 'success',
    });

    return { accessToken, refreshToken, expiresIn: 900, sessionId };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Account lockout, 2FA challenge, and trusted-device helpers — shared by
  // both the student and admin login paths above.
  // ═══════════════════════════════════════════════════════════════════════

  private assertNotLocked(lockedUntil: Date | null | undefined): void {
    if (!lockedUntil || lockedUntil.getTime() <= Date.now()) return;
    const minutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000);
    throw new AccountLockedException(minutes);
  }

  /** Increments the failed-login counter and, once it crosses the
   * configured threshold, locks the account for ACCOUNT_LOCKOUT_MINUTES.
   * This is a DB-backed lockout layered on top of LoginRateLimiterService's
   * in-memory per-email+IP limiter — it survives server restarts and isn't
   * bypassed by rotating IPs. */
  private async registerFailedAttempt(
    repo: { incrementFailedLoginCount(id: string): Promise<number>; setLockedUntil(id: string, until: Date | null): unknown },
    userId: string,
    actorType: SecurityActorType,
    ctx: RequestContext,
  ): Promise<void> {
    const threshold = this.config.get<number>('ACCOUNT_LOCKOUT_THRESHOLD') ?? 10;
    const lockoutMinutes = this.config.get<number>('ACCOUNT_LOCKOUT_MINUTES') ?? 30;

    const failCount = await repo.incrementFailedLoginCount(userId);
    this.events.emit(SECURITY_EVENTS.LOGIN_ATTEMPT, {
      userId, actorType, ip: ctx.ip, userAgent: ctx.userAgent, loginMethod: 'password', status: 'failed', failureReason: 'invalid_credentials',
    });

    if (failCount >= threshold) {
      await repo.setLockedUntil(userId, new Date(Date.now() + lockoutMinutes * 60_000));
      if (actorType === 'student') this.events.emit(NOTIFICATION_EVENTS.AUTH_ACCOUNT_LOCKED, { userId, minutes: lockoutMinutes });
    } else if (failCount === Math.ceil(threshold / 2) && actorType === 'student') {
      this.events.emit(NOTIFICATION_EVENTS.AUTH_SUSPICIOUS_LOGIN, { userId, ip: ctx.ip, userAgent: ctx.userAgent });
    }
  }

  /** Blocks reusing any of the account's last 5 passwords (passwordHistory
   * is maintained by UserRepository.setPasswordHash / AdminUserRepository's
   * equivalents — see their $push …$slice: -5). */
  private async assertPasswordNotReused(newPassword: string, passwordHistory: string[] | undefined): Promise<void> {
    if (!passwordHistory?.length) return;
    for (const oldHash of passwordHistory) {
      if (await this.passwordService.compare(newPassword, oldHash)) throw new PasswordReusedException();
    }
  }

  private isDeviceRemembered(trustedFingerprints: string[] | undefined, ctx: RequestContext): boolean {
    if (!trustedFingerprints?.length) return false;
    return trustedFingerprints.includes(fingerprintDevice(ctx.userAgent, ctx.ip));
  }

  private async issueTwoFactorChallenge(userId: string, actorType: SecurityActorType, method: string | null, email: string | undefined): Promise<TwoFactorChallenge> {
    const resolvedMethod: 'totp' | 'email' = method === 'email' ? 'email' : 'totp';

    // Email-OTP method: the code has to be sent now, at challenge time —
    // unlike TOTP, where the student already has a running code in their
    // authenticator app. Reuses the same generate/store/email primitive
    // this class already uses for password-reset OTPs, rather than
    // depending on TwoFactorService (would create an AuthModule ->
    // SecurityModule -> AuthModule cycle — see security.events.ts header).
    if (resolvedMethod === 'email' && email) {
      await this.otpTokenRepo.invalidateAll(userId, '2fa_login');
      const { code, hash } = this.tokenService.generateOtpCode();
      const expiryMins = this.config.get<number>('OTP_EXPIRY_MINUTES') ?? 10;
      await this.otpTokenRepo.create(userId, '2fa_login', hash, minutesFromNow(expiryMins));
      await this.mailer.sendTemplate(email, 'two_factor_code', { code, expiryMinutes: String(expiryMins) });
    }

    return {
      requires2FA: true,
      pendingToken: this.tokenService.generatePendingTwoFactorToken({ sub: userId, actorType }),
      method: resolvedMethod,
    };
  }

  private toPublicStudent(user: UserDocument): PublicStudent {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.fullName,
      avatarUrl: user.photoUrl,
      provider: user.authProvider,
      role: 'student',
      isEmailVerified: user.isEmailVerified,
      onboardingCompleted: user.onboarding?.completed ?? false,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Email delivery (dev-friendly: logs to console alongside SMTP send so
  // codes are visible even without SMTP configured, matching the pattern
  // the rest of this service already uses for reset emails)
  // ═══════════════════════════════════════════════════════════════════════

  private async sendResetEmail(to: string, rawToken: string, expiryMins: number): Promise<void> {
    await this.mailer.deliverEmail(to, 'Reset your CareerCompass AI admin password', `<h1>Reset your password</h1><p>Reset code: <strong>${rawToken}</strong><br>Expires in ${expiryMins} minutes.</p>`);
  }

  private async sendOtpEmail(to: string, code: string, expiryMins: number): Promise<void> {
    await this.mailer.sendTemplate(to, 'password_reset', { code, expiryMinutes: String(expiryMins) });
  }
}
