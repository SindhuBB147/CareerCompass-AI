import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { BreachDetectionService } from './breach-detection.service';

export type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

/** Mirrors apps/web/src/components/auth/PasswordStrengthMeter.tsx's scoring
 * exactly, so the server-reported strength never disagrees with what the
 * student sees while typing. */
export function scorePasswordStrength(password: string): { level: StrengthLevel; score: number } {
  if (!password) return { level: 'weak', score: 0 };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 'weak', score: 1 };
  if (score === 2) return { level: 'fair', score: 2 };
  if (score <= 4) return { level: 'good', score: 3 };
  return { level: 'strong', score: 4 };
}

@Injectable()
export class PasswordPolicyService {
  constructor(
    private readonly config: ConfigService,
    private readonly breachDetection: BreachDetectionService,
  ) {}

  strength(password: string) {
    return scorePasswordStrength(password);
  }

  async isReused(candidatePlaintext: string, passwordHistory: string[]): Promise<boolean> {
    for (const hash of passwordHistory) {
      if (await bcrypt.compare(candidatePlaintext, hash)) return true;
    }
    return false;
  }

  isExpired(passwordChangedAt: Date | null): boolean {
    const expiryDays = this.config.get<number>('PASSWORD_EXPIRY_DAYS') ?? 0;
    if (!expiryDays || !passwordChangedAt) return false;
    const ageMs = Date.now() - new Date(passwordChangedAt).getTime();
    return ageMs > expiryDays * 24 * 60 * 60 * 1000;
  }

  async checkBreach(password: string) {
    return this.breachDetection.checkPassword(password);
  }
}
