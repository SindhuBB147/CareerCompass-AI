import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { DomainException } from '../../../common/filters/domain.exception';

export interface VerifiedGoogleIdentity {
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

/**
 * Verifies a Google Identity Services ID token server-side (signature +
 * audience + issuer, via Google's public keys) — the frontend never hands
 * us identity fields we're expected to trust; everything here comes back
 * out of the verified token payload only.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly client: OAuth2Client;
  private readonly clientId: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    this.client = new OAuth2Client(this.clientId);
  }

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
    if (!this.clientId) {
      throw new DomainException('OAUTH_NOT_CONFIGURED', 'Google sign-in is not configured on this server.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!idToken) {
      throw new DomainException('INVALID_OAUTH_TOKEN', 'Missing Google ID token.', HttpStatus.UNAUTHORIZED);
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
      payload = ticket.getPayload();
    } catch {
      throw new DomainException('INVALID_OAUTH_TOKEN', 'Google sign-in failed — the token could not be verified.', HttpStatus.UNAUTHORIZED);
    }

    if (!payload?.sub || !payload.email) {
      throw new DomainException('INVALID_OAUTH_TOKEN', 'Google sign-in failed — the token did not contain the expected identity.', HttpStatus.UNAUTHORIZED);
    }

    return {
      providerId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name ?? payload.email,
      avatarUrl: payload.picture,
      emailVerified: payload.email_verified ?? false,
    };
  }
}
