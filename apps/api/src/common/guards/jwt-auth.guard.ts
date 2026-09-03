import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';

/**
 * Registered globally via APP_GUARD in AppModule. Every route requires a
 * valid JWT access token UNLESS the handler or its controller is marked
 * @Public(). This is the fail-closed default established in Module 1's
 * architecture review — a future module that forgets @Public() on a route
 * that should be public gets a 401 (loud, immediately caught in testing),
 * not a silently open endpoint.
 */
@Injectable()
export class GlobalJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
