import { authenticator } from 'otplib';
import { TwoFactorService } from '../../src/modules/security/services/two-factor.service';
import { encryptSecret } from '../../src/modules/security/utils/crypto.util';
import { TwoFactorSetupNotStartedException, InvalidTwoFactorCodeException } from '../../src/modules/security/security.exceptions';

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  let repoMock: any;
  let otpRepoMock: any;
  let tokenServiceMock: any;
  let mailerMock: any;
  let configMock: any;

  const ENCRYPTION_KEY = '1'.repeat(64);

  beforeEach(() => {
    repoMock = {
      findByUser: jest.fn(),
      upsertSecret: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn(),
      regenerateRecoveryCodes: jest.fn(),
      markRecoveryCodeUsed: jest.fn(),
      trustDeviceForTwoFactor: jest.fn(),
    };
    otpRepoMock = { invalidateAll: jest.fn(), create: jest.fn(), findActive: jest.fn(), incrementAttempts: jest.fn(), markUsed: jest.fn() };
    tokenServiceMock = {
      generateOtpCode: jest.fn(() => ({ code: '123456', hash: 'hash_123456' })),
      hashToken: jest.fn((v: string) => `hash_${v}`),
    };
    mailerMock = { sendTemplate: jest.fn() };
    configMock = { get: jest.fn((key: string) => (key === 'SECURITY_ENCRYPTION_KEY' ? ENCRYPTION_KEY : null)) };

    service = new TwoFactorService(repoMock, otpRepoMock, tokenServiceMock, mailerMock, configMock);
  });

  describe('initiateTotpSetup / confirmTotpSetup', () => {
    it('generates a secret + QR code and stores it encrypted, not in plaintext', async () => {
      const result = await service.initiateTotpSetup('usr_1', 'student', 'student@example.com');
      expect(result.secret).toBeDefined();
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

      expect(repoMock.upsertSecret).toHaveBeenCalledWith('usr_1', 'student', 'totp', expect.any(String));
      const storedSecret = repoMock.upsertSecret.mock.calls[0][3];
      expect(storedSecret).not.toContain(result.secret); // encrypted, not plaintext
    });

    it('rejects confirming setup that was never started', async () => {
      repoMock.findByUser.mockResolvedValue(null);
      await expect(service.confirmTotpSetup('usr_1', 'student', '123456')).rejects.toBeInstanceOf(TwoFactorSetupNotStartedException);
    });

    it('rejects an incorrect TOTP code and does not enable 2FA', async () => {
      const secret = authenticator.generateSecret();
      repoMock.findByUser.mockResolvedValue({ totpSecretEncrypted: encryptSecret(secret, ENCRYPTION_KEY), recoveryCodes: [] });

      await expect(service.confirmTotpSetup('usr_1', 'student', '000000')).rejects.toBeInstanceOf(InvalidTwoFactorCodeException);
      expect(repoMock.enable).not.toHaveBeenCalled();
    });

    it('enables 2FA and returns 10 recovery codes on a correct TOTP code', async () => {
      const secret = authenticator.generateSecret();
      repoMock.findByUser.mockResolvedValue({ totpSecretEncrypted: encryptSecret(secret, ENCRYPTION_KEY), recoveryCodes: [] });
      const validCode = authenticator.generate(secret);

      const codes = await service.confirmTotpSetup('usr_1', 'student', validCode);
      expect(codes).toHaveLength(10);
      expect(repoMock.enable).toHaveBeenCalledWith('usr_1', 'student', expect.any(Array));
      // Recovery codes must be hashed before storage, not stored raw.
      const storedHashes = repoMock.enable.mock.calls[0][2];
      expect(storedHashes).not.toContain(codes[0]);
    });
  });

  describe('verifyLoginChallenge', () => {
    it('returns false when 2FA is not enabled on the account', async () => {
      repoMock.findByUser.mockResolvedValue({ isEnabled: false });
      await expect(service.verifyLoginChallenge('usr_1', 'student', '123456')).resolves.toBe(false);
    });

    it('accepts a valid TOTP code for an enabled account', async () => {
      const secret = authenticator.generateSecret();
      repoMock.findByUser.mockResolvedValue({ isEnabled: true, method: 'totp', totpSecretEncrypted: encryptSecret(secret, ENCRYPTION_KEY) });
      const validCode = authenticator.generate(secret);
      await expect(service.verifyLoginChallenge('usr_1', 'student', validCode)).resolves.toBe(true);
    });

    it('rejects an invalid TOTP code', async () => {
      const secret = authenticator.generateSecret();
      repoMock.findByUser.mockResolvedValue({ isEnabled: true, method: 'totp', totpSecretEncrypted: encryptSecret(secret, ENCRYPTION_KEY) });
      await expect(service.verifyLoginChallenge('usr_1', 'student', '000000')).resolves.toBe(false);
    });
  });

  describe('verifyRecoveryCode', () => {
    it('accepts a valid recovery code once, then rejects reuse', async () => {
      const bcrypt = require('bcrypt');
      const codeHash = await bcrypt.hash('ABCD-1234', 10);
      const record = { recoveryCodes: [{ codeHash, usedAt: null }] };
      repoMock.findByUser.mockResolvedValue(record);

      const firstUse = await service.verifyRecoveryCode('usr_1', 'student', 'ABCD-1234');
      expect(firstUse).toBe(true);
      expect(repoMock.markRecoveryCodeUsed).toHaveBeenCalledWith('usr_1', 'student', codeHash);

      // Simulate the code now being marked used (as the repo would persist).
      record.recoveryCodes[0].usedAt = new Date() as any;
      const secondUse = await service.verifyRecoveryCode('usr_1', 'student', 'ABCD-1234');
      expect(secondUse).toBe(false);
    });
  });
});
