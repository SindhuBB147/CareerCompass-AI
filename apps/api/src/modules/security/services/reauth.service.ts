import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../../users/repositories/user.repository';
import { AdminUserRepository } from '../../auth/repositories/admin-user.repository';
import { PasswordService } from '../../auth/services/password.service';
import { TokenService } from '../../auth/services/token.service';
import { InvalidCredentialsException } from '../../auth/auth.exceptions';
import { SecurityActorType } from '../models/two-factor-auth.model';

/** Issues a short-lived step-up token after re-verifying the caller's
 * current password — required by @RequireReauth() routes for high-risk
 * admin actions (delete data, change roles, AI config, etc). */
@Injectable()
export class ReauthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly adminRepo: AdminUserRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
  ) {}

  async verifyAndIssue(userId: string, actorType: SecurityActorType, currentPassword: string): Promise<string> {
    const doc = actorType === 'student' ? await this.userRepo.findById(userId) : await this.adminRepo.findById(userId);
    if (!doc || !(doc as any).passwordHash) throw new InvalidCredentialsException();

    const matches = await this.passwordService.compare(currentPassword, (doc as any).passwordHash);
    if (!matches) throw new InvalidCredentialsException();

    const ttl = this.config.get<number>('REAUTH_TOKEN_TTL_MINUTES') ?? 5;
    return this.tokenService.generateReauthToken(userId, ttl);
  }
}
