import { Injectable } from '@nestjs/common';

/**
 * Future-ready stub: no breach-database provider (e.g. HaveIBeenPwned
 * k-anonymity API) is configured today, and silently sending password
 * hashes to a third-party service is a data-sharing decision that needs
 * explicit opt-in, not something to wire up unannounced. This gives
 * PasswordPolicyService a stable interface to call so a real provider can
 * be dropped in later without touching call sites.
 */
@Injectable()
export class BreachDetectionService {
  async checkPassword(_password: string): Promise<{ checked: boolean; breached: boolean }> {
    return { checked: false, breached: false };
  }
}
