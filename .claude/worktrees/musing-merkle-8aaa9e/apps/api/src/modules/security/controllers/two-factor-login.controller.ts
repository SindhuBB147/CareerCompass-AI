import { Body, Controller, HttpCode, HttpStatus, Ip, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../../../common/decorators/auth.decorators';
import { AuthService } from '../../auth/services/auth.service';
import { TokenService } from '../../auth/services/token.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { AdminUserRepository } from '../../auth/repositories/admin-user.repository';
import { TwoFactorService } from '../services/two-factor.service';
import { DeviceService } from '../services/device.service';
import { VerifyTwoFactorDto } from '../security.dto';
import { InvalidPendingTokenException, InvalidTwoFactorCodeException } from '../security.exceptions';

/**
 * Completes a login that AuthService paused for a 2FA challenge (see
 * AuthService.studentLogin/login — when the account has 2FA enabled, those
 * methods return { requires2FA, pendingToken } instead of real tokens).
 * Lives here rather than in AuthController because it needs TwoFactorService
 * to check the code — and SecurityModule already depends on AuthModule (via
 * AuthService), so putting it here avoids the reverse dependency that would
 * create a module cycle.
 */
@Controller('auth')
export class TwoFactorLoginController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly twoFactor: TwoFactorService,
    private readonly devices: DeviceService,
    private readonly authService: AuthService,
    private readonly userRepo: UserRepository,
    private readonly adminRepo: AdminUserRepository,
  ) {}

  @Post('2fa/verify') @Public() @HttpCode(HttpStatus.OK) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verify(@Body() dto: VerifyTwoFactorDto, @Req() req: Request, @Ip() ip: string) {
    let payload;
    try {
      payload = this.tokenService.verifyPendingTwoFactorToken(dto.pendingToken);
    } catch {
      throw new InvalidPendingTokenException();
    }

    const valid = await this.twoFactor.verifyLoginChallenge(payload.sub, payload.actorType, dto.code);
    if (!valid) throw new InvalidTwoFactorCodeException();

    const userAgent = req.headers['user-agent'];
    if (dto.trustThisDevice) {
      const fingerprint = this.devices.fingerprint(ip, userAgent);
      await this.twoFactor.trustDevice(payload.sub, payload.actorType, fingerprint);
      if (payload.actorType === 'student') await this.userRepo.addTrustedTwoFactorFingerprint(payload.sub, fingerprint);
      else await this.adminRepo.addTrustedTwoFactorFingerprint(payload.sub, fingerprint);
    }

    const result = await this.authService.completeTwoFactorLogin(payload.sub, payload.actorType, { ip, userAgent });
    return { success: true, data: result };
  }
}
