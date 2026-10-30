import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { TwoFactorAuthRepository } from '../repositories/two-factor-auth.repository';
import { OtpTokenRepository } from '../../auth/repositories/otp-token.repository';
import { TokenService } from '../../auth/services/token.service';
import { MailerService } from '../../../common/mailer/mailer.service';
import { minutesFromNow } from '../../../common/utils/date.util';
import { encryptSecret, decryptSecret } from '../utils/crypto.util';
import { SecurityActorType, TwoFactorMethod } from '../models/two-factor-auth.model';
import { InvalidTwoFactorCodeException, TwoFactorSetupNotStartedException } from '../security.exceptions';

const RECOVERY_CODE_COUNT = 10;

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly repo: TwoFactorAuthRepository,
    private readonly otpRepo: OtpTokenRepository,
    private readonly tokenService: TokenService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  private encryptionKey() { return this.config.get<string>('SECURITY_ENCRYPTION_KEY'); }

  async status(userId: string, actorType: SecurityActorType) {
    const record = await this.repo.findByUser(userId, actorType);
    return {
      isEnabled: record?.isEnabled ?? false,
      method: record?.method ?? null,
      enabledAt: record?.enabledAt ?? null,
      recoveryCodesRemaining: record?.recoveryCodes.filter(c => !c.usedAt).length ?? 0,
    };
  }

  // ── TOTP (Google/Microsoft Authenticator) ─────────────────────────────────

  async initiateTotpSetup(userId: string, actorType: SecurityActorType, accountLabel: string) {
    const secret = authenticator.generateSecret();
    const issuer = this.config.get<string>('TWO_FA_ISSUER_NAME') ?? 'CareerCompass AI';
    const otpauth = authenticator.keyuri(accountLabel, issuer, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
    await this.repo.upsertSecret(userId, actorType, 'totp', encryptSecret(secret, this.encryptionKey()));
    return { secret, qrCodeDataUrl, otpauth };
  }

  async confirmTotpSetup(userId: string, actorType: SecurityActorType, code: string): Promise<string[]> {
    const record = await this.repo.findByUser(userId, actorType);
    if (!record?.totpSecretEncrypted) throw new TwoFactorSetupNotStartedException();

    const secret = decryptSecret(record.totpSecretEncrypted, this.encryptionKey());
    if (!authenticator.verify({ token: code, secret })) throw new InvalidTwoFactorCodeException();

    return this.enableWithRecoveryCodes(userId, actorType);
  }

  // ── Email OTP ──────────────────────────────────────────────────────────────

  async initiateEmailSetup(userId: string, actorType: SecurityActorType, email: string) {
    await this.repo.upsertSecret(userId, actorType, 'email', null);
    await this.sendLoginOtp(userId, email, '2fa_setup');
  }

  async confirmEmailSetup(userId: string, actorType: SecurityActorType, code: string): Promise<string[]> {
    const valid = await this.consumeOtp(userId, '2fa_setup', code);
    if (!valid) throw new InvalidTwoFactorCodeException();
    return this.enableWithRecoveryCodes(userId, actorType);
  }

  async sendLoginOtp(userId: string, email: string, purpose: '2fa_login' | '2fa_setup' = '2fa_login') {
    await this.otpRepo.invalidateAll(userId, purpose);
    const { code, hash } = this.tokenService.generateOtpCode();
    const expiryMins = this.config.get<number>('OTP_EXPIRY_MINUTES') ?? 10;
    await this.otpRepo.create(userId, purpose, hash, minutesFromNow(expiryMins));
    await this.mailer.sendTemplate(email, 'two_factor_code', { code, expiryMinutes: String(expiryMins) });
  }

  private async consumeOtp(userId: string, purpose: string, code: string): Promise<boolean> {
    const record = await this.otpRepo.findActive(userId, purpose);
    if (!record || record.attempts >= 5) return false;
    if (record.codeHash !== this.tokenService.hashToken(code)) {
      await this.otpRepo.incrementAttempts(record.id);
      return false;
    }
    await this.otpRepo.markUsed(record.id);
    return true;
  }

  // ── Verification at login time (TOTP, email OTP, or recovery code) ────────

  async verifyLoginChallenge(userId: string, actorType: SecurityActorType, code: string): Promise<boolean> {
    const record = await this.repo.findByUser(userId, actorType);
    if (!record?.isEnabled) return false;

    if (/^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(code.trim())) {
      return this.verifyRecoveryCode(userId, actorType, code.trim());
    }

    if (record.method === 'totp') {
      if (!record.totpSecretEncrypted) return false;
      const secret = decryptSecret(record.totpSecretEncrypted, this.encryptionKey());
      return authenticator.verify({ token: code, secret });
    }

    return this.consumeOtp(userId, '2fa_login', code);
  }

  async verifyRecoveryCode(userId: string, actorType: SecurityActorType, code: string): Promise<boolean> {
    const record = await this.repo.findByUser(userId, actorType);
    if (!record) return false;
    for (const entry of record.recoveryCodes) {
      if (entry.usedAt) continue;
      if (await bcrypt.compare(code.toUpperCase(), entry.codeHash)) {
        await this.repo.markRecoveryCodeUsed(userId, actorType, entry.codeHash);
        return true;
      }
    }
    return false;
  }

  async trustDevice(userId: string, actorType: SecurityActorType, fingerprint: string) {
    await this.repo.trustDeviceForTwoFactor(userId, actorType, fingerprint);
  }

  async isDeviceTrusted(userId: string, actorType: SecurityActorType, fingerprint: string): Promise<boolean> {
    const record = await this.repo.findByUser(userId, actorType);
    return record?.trustedDeviceFingerprints.includes(fingerprint) ?? false;
  }

  // ── Disable / recovery codes ────────────────────────────────────────────

  async disable(userId: string, actorType: SecurityActorType) {
    await this.repo.disable(userId, actorType);
  }

  async regenerateRecoveryCodes(userId: string, actorType: SecurityActorType): Promise<string[]> {
    const { codes, hashes } = await this.generateRecoveryCodes();
    await this.repo.regenerateRecoveryCodes(userId, actorType, hashes);
    return codes;
  }

  private async enableWithRecoveryCodes(userId: string, actorType: SecurityActorType): Promise<string[]> {
    const { codes, hashes } = await this.generateRecoveryCodes();
    await this.repo.enable(userId, actorType, hashes);
    return codes;
  }

  private async generateRecoveryCodes(): Promise<{ codes: string[]; hashes: string[] }> {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
      return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    });
    const hashes = await Promise.all(codes.map(c => bcrypt.hash(c, 10)));
    return { codes, hashes };
  }
}
