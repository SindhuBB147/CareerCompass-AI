import { AuthService, StudentAuthTokens } from '../../src/modules/auth/services/auth.service';
import { PublicStudent } from '../../src/modules/auth/services/auth.service';
import { TokenService } from '../../src/modules/auth/services/token.service';
import { PasswordService } from '../../src/modules/auth/services/password.service';
import {
  DuplicateEmailException, InvalidCredentialsException, InvalidOtpException,
  InvalidRefreshTokenException, TooManyOtpAttemptsException,
} from '../../src/modules/auth/auth.exceptions';
import { AccountLockedException } from '../../src/modules/security/security.exceptions';

describe('AuthService — student auth, OAuth linking, sessions', () => {
  let authService: AuthService;
  let adminUserRepoMock: any;
  let userRepoMock: any;
  let resetTokenRepoMock: any;
  let otpTokenRepoMock: any;
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let rateLimiterMock: any;
  let configMock: any;
  let googleOAuthServiceMock: any;

  const baseUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'usr_1',
    email: 'student@example.com',
    fullName: 'Test Student',
    passwordHash: null,
    accountStatus: 'active',
    isEmailVerified: false,
    authProvider: 'password',
    photoUrl: undefined,
    phone: undefined,
    linkedAccounts: [],
    sessions: [],
    onboarding: { completed: false },
    ...overrides,
  });

  beforeEach(() => {
    adminUserRepoMock = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      updateRefreshTokenHash: jest.fn(),
      recordLoginAndRotateRefreshToken: jest.fn(),
    };
    userRepoMock = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByLinkedAccount: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      setPasswordHash: jest.fn(),
      addSession: jest.fn(),
      rotateSession: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllSessions: jest.fn(),
      linkAccount: jest.fn(),
      markEmailVerified: jest.fn(),
      resetFailedLoginCount: jest.fn(),
      incrementFailedLoginCount: jest.fn().mockResolvedValue(1),
      setLockedUntil: jest.fn(),
    };
    resetTokenRepoMock = {};
    otpTokenRepoMock = {
      invalidateAll: jest.fn(),
      create: jest.fn(),
      findActive: jest.fn(),
      incrementAttempts: jest.fn(),
      markUsed: jest.fn(),
    };
    passwordService = new PasswordService();
    rateLimiterMock = { checkAndThrow: jest.fn(), recordFailure: jest.fn(), recordSuccess: jest.fn() };

    const jwtServiceMock = new (require('@nestjs/jwt').JwtService)();
    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'test_jwt_access_secret_key_1234567890_super_secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test_refresh_secret_key_1234567890_secret';
        if (key === 'JWT_ACCESS_EXPIRY') return '15m';
        if (key === 'JWT_REFRESH_EXPIRY') return '7d';
        return null;
      }),
    };
    tokenService = new TokenService(jwtServiceMock, configMock as any);
    googleOAuthServiceMock = { verifyIdToken: jest.fn() };

    authService = new AuthService(
      adminUserRepoMock,
      userRepoMock,
      resetTokenRepoMock,
      otpTokenRepoMock,
      passwordService,
      tokenService,
      rateLimiterMock,
      configMock,
      { deliverEmail: jest.fn(), sendTemplate: jest.fn() } as any,
      { emit: jest.fn() } as any,
      googleOAuthServiceMock,
    );
  });

  // ── OAuth ──────────────────────────────────────────────────────────────
  // loginWithGoogle only ever acts on a server-VERIFIED identity (the
  // GoogleOAuthService mock stands in for the real ID-token verification —
  // see google-oauth.service.ts) — never on client-supplied email/name, since
  // that used to be a live auth-bypass hole (any caller could assert an
  // arbitrary identity and be logged in as it).

  describe('loginWithGoogle', () => {
    it('creates a real student User record (not an AdminUser) on first Google sign-in', async () => {
      userRepoMock.findByEmail.mockResolvedValue(null);
      const created = baseUser({ id: 'usr_oauth_123', email: 'student.test@gmail.com', fullName: 'Google Student', authProvider: 'google', isEmailVerified: true });
      userRepoMock.create.mockResolvedValue(created);
      userRepoMock.addSession.mockResolvedValue(created);
      googleOAuthServiceMock.verifyIdToken.mockResolvedValue({
        providerId: 'google_sub_123', email: 'student.test@gmail.com', name: 'Google Student', emailVerified: true,
      });

      const result = await authService.loginWithGoogle('valid_id_token');

      expect(userRepoMock.create).toHaveBeenCalledWith(expect.objectContaining({
        email: 'student.test@gmail.com', fullName: 'Google Student', authProvider: 'google', accountStatus: 'active',
      }));
      expect(adminUserRepoMock.create).not.toHaveBeenCalled();

      expect(result.user.role).toBe('student');
      expect(result.user.id).toBe('usr_oauth_123');
      expect(result.user.provider).toBe('google');

      const payload = tokenService.verifyAccessToken(result.tokens.accessToken);
      expect(payload.role).toBe('student');
      expect(payload.sub).toBe('usr_oauth_123');
    });

    it('links Google onto an existing account instead of creating a duplicate', async () => {
      const existing = baseUser({ id: 'usr_existing', email: 'returning@gmail.com', fullName: 'Returning Student' });
      userRepoMock.findByEmail.mockResolvedValue(existing);
      userRepoMock.linkAccount.mockResolvedValue({ ...existing, linkedAccounts: [{ provider: 'google', providerId: 'google_sub_456' }] });
      userRepoMock.addSession.mockResolvedValue(existing);
      googleOAuthServiceMock.verifyIdToken.mockResolvedValue({
        providerId: 'google_sub_456', email: 'returning@gmail.com', name: 'Returning Student', emailVerified: true,
      });

      const result = await authService.loginWithGoogle('valid_id_token');

      expect(userRepoMock.create).not.toHaveBeenCalled();
      expect(userRepoMock.linkAccount).toHaveBeenCalledWith('usr_existing', expect.objectContaining({ provider: 'google' }));
      expect(result.user.id).toBe('usr_existing');
      expect(result.user.provider).toBe('google');
    });

    it('rejects and never touches the user repo when the ID token fails verification', async () => {
      googleOAuthServiceMock.verifyIdToken.mockRejectedValue(new Error('invalid token'));

      await expect(authService.loginWithGoogle('bad_token')).rejects.toThrow();
      expect(userRepoMock.findByEmail).not.toHaveBeenCalled();
      expect(userRepoMock.create).not.toHaveBeenCalled();
    });
  });

  // ── Registration / login ────────────────────────────────────────────────

  describe('registerStudent', () => {
    it('creates a new password account when the email is unused', async () => {
      userRepoMock.findByEmail.mockResolvedValue(null);
      const created = baseUser({ id: 'usr_new' });
      userRepoMock.create.mockResolvedValue(created);
      userRepoMock.addSession.mockResolvedValue(created);

      const result = await authService.registerStudent(
        { fullName: 'Test Student', email: 'student@example.com', password: 'Passw0rd!' },
        { ip: '127.0.0.1' },
      );

      expect(userRepoMock.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'student@example.com', authProvider: 'password' }));
      expect(result.user.id).toBe('usr_new');
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('rejects registration when the email already has a password account', async () => {
      userRepoMock.findByEmail.mockResolvedValue(baseUser({ passwordHash: 'existing_hash' }));

      await expect(authService.registerStudent(
        { fullName: 'Test Student', email: 'student@example.com', password: 'Passw0rd!' },
        { ip: '127.0.0.1' },
      )).rejects.toBeInstanceOf(DuplicateEmailException);
    });

    it('adds password login to an existing OAuth-only account instead of rejecting', async () => {
      const oauthUser = baseUser({ passwordHash: null });
      userRepoMock.findByEmail.mockResolvedValue(oauthUser);
      userRepoMock.setPasswordHash.mockResolvedValue({ ...oauthUser, passwordHash: 'new_hash' });
      userRepoMock.addSession.mockResolvedValue(oauthUser);

      const result = await authService.registerStudent(
        { fullName: 'Test Student', email: 'student@example.com', password: 'Passw0rd!' },
        { ip: '127.0.0.1' },
      );

      expect(userRepoMock.setPasswordHash).toHaveBeenCalled();
      expect(result.user.id).toBe('usr_1');
    });
  });

  describe('studentLogin', () => {
    it('logs in with correct credentials', async () => {
      const hash = await passwordService.hash('Passw0rd!');
      const user = baseUser({ passwordHash: hash });
      userRepoMock.findByEmail.mockResolvedValue(user);
      userRepoMock.addSession.mockResolvedValue(user);

      const result = await authService.studentLogin('student@example.com', 'Passw0rd!', { ip: '127.0.0.1' }) as { tokens: StudentAuthTokens; user: PublicStudent };
      expect(result.user.id).toBe('usr_1');
      expect(rateLimiterMock.recordSuccess).toHaveBeenCalled();
    });

    it('rejects an incorrect password', async () => {
      const hash = await passwordService.hash('Passw0rd!');
      userRepoMock.findByEmail.mockResolvedValue(baseUser({ passwordHash: hash }));

      await expect(authService.studentLogin('student@example.com', 'WrongPass1', { ip: '127.0.0.1' }))
        .rejects.toBeInstanceOf(InvalidCredentialsException);
      expect(rateLimiterMock.recordFailure).toHaveBeenCalled();
    });

    it('rejects login for an OAuth-only account with no password set', async () => {
      userRepoMock.findByEmail.mockResolvedValue(baseUser({ passwordHash: null }));
      await expect(authService.studentLogin('student@example.com', 'anything', { ip: '127.0.0.1' }))
        .rejects.toBeInstanceOf(InvalidCredentialsException);
    });

    it('returns a 2FA challenge instead of tokens when the account has 2FA enabled', async () => {
      const hash = await passwordService.hash('Passw0rd!');
      const user = baseUser({ passwordHash: hash, twoFactorEnabled: true, twoFactorMethod: 'totp', twoFactorTrustedDeviceFingerprints: [] });
      userRepoMock.findByEmail.mockResolvedValue(user);

      const result = await authService.studentLogin('student@example.com', 'Passw0rd!', { ip: '127.0.0.1' });
      expect((result as any).requires2FA).toBe(true);
      expect((result as any).pendingToken).toBeDefined();
      expect((result as any).method).toBe('totp');
      expect(userRepoMock.addSession).not.toHaveBeenCalled();
    });

    it('skips the 2FA challenge when the login comes from a remembered device', async () => {
      const hash = await passwordService.hash('Passw0rd!');
      const fingerprint = require('../../src/modules/security/utils/crypto.util').fingerprintDevice('jest-agent', '127.0.0.1');
      const user = baseUser({
        passwordHash: hash, twoFactorEnabled: true, twoFactorMethod: 'totp',
        twoFactorTrustedDeviceFingerprints: [fingerprint],
      });
      userRepoMock.findByEmail.mockResolvedValue(user);
      userRepoMock.addSession.mockResolvedValue(user);

      const result = await authService.studentLogin('student@example.com', 'Passw0rd!', { ip: '127.0.0.1', userAgent: 'jest-agent' }) as { tokens: StudentAuthTokens; user: PublicStudent };
      expect(result.user.id).toBe('usr_1');
      expect(userRepoMock.addSession).toHaveBeenCalled();
    });

    it('locks the account after too many failed attempts', async () => {
      const hash = await passwordService.hash('Passw0rd!');
      userRepoMock.findByEmail.mockResolvedValue(baseUser({ passwordHash: hash }));
      userRepoMock.incrementFailedLoginCount.mockResolvedValue(10);

      await expect(authService.studentLogin('student@example.com', 'WrongPass1', { ip: '127.0.0.1' }))
        .rejects.toBeInstanceOf(InvalidCredentialsException);
      expect(userRepoMock.setLockedUntil).toHaveBeenCalledWith('usr_1', expect.any(Date));
    });

    it('rejects login while the account is locked, without touching the password', async () => {
      const hash = await passwordService.hash('Passw0rd!');
      userRepoMock.findByEmail.mockResolvedValue(baseUser({ passwordHash: hash, lockedUntil: new Date(Date.now() + 10 * 60 * 1000) }));
      await expect(authService.studentLogin('student@example.com', 'Passw0rd!', { ip: '127.0.0.1' }))
        .rejects.toBeInstanceOf(AccountLockedException);
    });
  });

  // ── Sessions / refresh ───────────────────────────────────────────────────

  describe('studentRefreshTokens', () => {
    it('rotates the refresh token for a matching session', async () => {
      const accessToken = tokenService.generateAccessToken({ sub: 'usr_1', email: 'student@example.com', role: 'student' });
      const refreshToken = tokenService.generateRefreshToken({ sub: 'usr_1', tokenId: 'session_1' });
      const refreshHash = tokenService.hashToken(refreshToken);

      userRepoMock.findById.mockResolvedValue(baseUser({ sessions: [{ sessionId: 'session_1', refreshTokenHash: refreshHash }] }));
      userRepoMock.rotateSession.mockResolvedValue(true);

      const result = await authService.studentRefreshTokens(refreshToken);
      expect(result.sessionId).toBe('session_1');
      expect(userRepoMock.rotateSession).toHaveBeenCalledWith('usr_1', 'session_1', expect.any(String));
      void accessToken;
    });

    it('revokes the session and rejects on a hash mismatch (stolen/replayed token)', async () => {
      const refreshToken = tokenService.generateRefreshToken({ sub: 'usr_1', tokenId: 'session_1' });
      userRepoMock.findById.mockResolvedValue(baseUser({ sessions: [{ sessionId: 'session_1', refreshTokenHash: 'different_hash' }] }));

      await expect(authService.studentRefreshTokens(refreshToken)).rejects.toBeInstanceOf(InvalidRefreshTokenException);
      expect(userRepoMock.revokeSession).toHaveBeenCalledWith('usr_1', 'session_1');
    });

    it('rejects an unknown/garbage refresh token', async () => {
      await expect(authService.studentRefreshTokens('not-a-jwt')).rejects.toBeInstanceOf(InvalidRefreshTokenException);
    });
  });

  // ── OTP password reset ───────────────────────────────────────────────────

  describe('resetPasswordStudent', () => {
    it('resets the password on a correct OTP and revokes all sessions', async () => {
      const user = baseUser();
      userRepoMock.findByEmail.mockResolvedValue(user);
      const codeHash = tokenService.hashToken('123456');
      otpTokenRepoMock.findActive.mockResolvedValue({ id: 'otp_1', codeHash, attempts: 0 });

      await authService.resetPasswordStudent('student@example.com', '123456', 'NewPassw0rd!');

      expect(userRepoMock.setPasswordHash).toHaveBeenCalledWith('usr_1', expect.any(String));
      expect(userRepoMock.revokeAllSessions).toHaveBeenCalledWith('usr_1');
      expect(otpTokenRepoMock.markUsed).toHaveBeenCalledWith('otp_1');
    });

    it('rejects an incorrect OTP and increments the attempt counter', async () => {
      userRepoMock.findByEmail.mockResolvedValue(baseUser());
      otpTokenRepoMock.findActive.mockResolvedValue({ id: 'otp_1', codeHash: tokenService.hashToken('123456'), attempts: 0 });

      await expect(authService.resetPasswordStudent('student@example.com', '000000', 'NewPassw0rd!'))
        .rejects.toBeInstanceOf(InvalidOtpException);
      expect(otpTokenRepoMock.incrementAttempts).toHaveBeenCalledWith('otp_1');
    });

    it('locks out after too many incorrect attempts', async () => {
      userRepoMock.findByEmail.mockResolvedValue(baseUser());
      otpTokenRepoMock.findActive.mockResolvedValue({ id: 'otp_1', codeHash: tokenService.hashToken('123456'), attempts: 5 });

      await expect(authService.resetPasswordStudent('student@example.com', '123456', 'NewPassw0rd!'))
        .rejects.toBeInstanceOf(TooManyOtpAttemptsException);
    });

    it('does not leak whether the email is registered', async () => {
      userRepoMock.findByEmail.mockResolvedValue(null);
      otpTokenRepoMock.findActive.mockResolvedValue(null);

      await expect(authService.resetPasswordStudent('nobody@example.com', '123456', 'NewPassw0rd!'))
        .rejects.toBeInstanceOf(InvalidOtpException);
    });
  });

  describe('changePasswordStudent', () => {
    it('changes the password on correct current password and revokes all sessions', async () => {
      const hash = await passwordService.hash('OldPassw0rd!');
      userRepoMock.findById.mockResolvedValue(baseUser({ passwordHash: hash }));

      await authService.changePasswordStudent('usr_1', 'OldPassw0rd!', 'NewPassw0rd!');

      expect(userRepoMock.setPasswordHash).toHaveBeenCalledWith('usr_1', expect.any(String));
      expect(userRepoMock.revokeAllSessions).toHaveBeenCalledWith('usr_1');
    });

    it('rejects an incorrect current password', async () => {
      const hash = await passwordService.hash('OldPassw0rd!');
      userRepoMock.findById.mockResolvedValue(baseUser({ passwordHash: hash }));

      await expect(authService.changePasswordStudent('usr_1', 'WrongOldPass1', 'NewPassw0rd!'))
        .rejects.toBeInstanceOf(InvalidCredentialsException);
    });
  });
});
