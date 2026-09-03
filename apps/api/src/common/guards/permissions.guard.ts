import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/auth.decorators';
import { AdminUserRepository } from '../../modules/auth/repositories/admin-user.repository';
import { hasPermission, Permission } from '../permissions';

/**
 * Registered globally via APP_GUARD, after GlobalJwtAuthGuard and RolesGuard.
 * Routes with no @RequirePermissions() pass through freely. Looks up the
 * admin's current permissions from the database rather than the JWT — the
 * JWT only carries a coarse role, and permissions can be edited without
 * forcing a re-login.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminUserRepo: AdminUserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Authentication required.' });
    }

    const admin = await this.adminUserRepo.findById(user.sub);
    if (!admin || !hasPermission(admin.role, admin.permissions, required)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Missing required permission: "${required}".`,
      });
    }
    return true;
  }
}
