import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_REAUTH_KEY } from '../../../common/decorators/auth.decorators';
import { TokenService } from '../../auth/services/token.service';
import { ReauthRequiredException } from '../security.exceptions';

/**
 * Registered globally via APP_GUARD, after GlobalJwtAuthGuard/RolesGuard/
 * PermissionsGuard. Routes without @RequireReauth() pass through freely.
 * Routes that declare it need a valid, still-fresh `x-reauth-token` header
 * (issued by POST /security/reauth after re-entering the current password)
 * belonging to the same caller as the main JWT — a stolen access token
 * alone can't perform the action.
 */
@Injectable()
export class ReauthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_REAUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const header = request.headers['x-reauth-token'];
    if (!header) throw new ReauthRequiredException();

    try {
      const payload = this.tokenService.verifyReauthToken(header);
      if (payload.sub !== request.user?.sub) throw new ReauthRequiredException();
    } catch {
      throw new ReauthRequiredException();
    }
    return true;
  }
}
