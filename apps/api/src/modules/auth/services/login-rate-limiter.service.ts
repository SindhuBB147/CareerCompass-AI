import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { TooManyLoginAttemptsException } from '../auth.exceptions';

interface AttemptRecord { count: number; firstAttemptAt: number; }

@Injectable()
export class LoginRateLimiterService implements OnModuleDestroy {
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly maxAttempts = 5;
  private readonly windowMs = 15 * 60 * 1000;
  private readonly cleanupHandle: NodeJS.Timeout;

  constructor() {
    this.cleanupHandle = setInterval(() => this.prune(), this.windowMs);
    this.cleanupHandle.unref();
  }

  onModuleDestroy() { clearInterval(this.cleanupHandle); }

  checkAndThrow(email: string, ip: string): void {
    const key = this.key(email, ip);
    const record = this.attempts.get(key);
    const now = Date.now();

    if (record && now - record.firstAttemptAt < this.windowMs) {
      if (record.count >= this.maxAttempts) {
        const retry = Math.ceil((this.windowMs - (now - record.firstAttemptAt)) / 1000);
        throw new TooManyLoginAttemptsException(retry);
      }
    } else {
      this.attempts.set(key, { count: 0, firstAttemptAt: now });
    }
  }

  recordFailure(email: string, ip: string): void {
    const key = this.key(email, ip);
    const r = this.attempts.get(key);
    if (r) r.count++;
    else this.attempts.set(key, { count: 1, firstAttemptAt: Date.now() });
  }

  recordSuccess(email: string, ip: string): void {
    this.attempts.delete(this.key(email, ip));
  }

  private prune(): void {
    const now = Date.now();
    for (const [k, r] of this.attempts)
      if (now - r.firstAttemptAt >= this.windowMs) this.attempts.delete(k);
  }

  private key(email: string, ip: string) { return `${email.toLowerCase()}::${ip}`; }
}
