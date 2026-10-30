import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../../src/common/guards/permissions.guard';
import { AdminUserRepository } from '../../src/modules/auth/repositories/admin-user.repository';
import { PERMISSIONS } from '../../src/common/permissions';

function makeContext(user: unknown, requiredPermission: string | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let reflector: Reflector;
  let adminUserRepo: jest.Mocked<Pick<AdminUserRepository, 'findById'>>;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = new Reflector();
    adminUserRepo = { findById: jest.fn() };
    guard = new PermissionsGuard(reflector, adminUserRepo as unknown as AdminUserRepository);
  });

  it('passes through when the route declares no required permission', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext({ sub: 'u1' }, undefined))).resolves.toBe(true);
    expect(adminUserRepo.findById).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when unauthenticated', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(PERMISSIONS.ADMINS_MANAGE);
    await expect(guard.canActivate(makeContext(undefined, PERMISSIONS.ADMINS_MANAGE))).rejects.toThrow(ForbiddenException);
  });

  it('allows a super_admin without needing an explicit grant', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(PERMISSIONS.ADMINS_MANAGE);
    adminUserRepo.findById.mockResolvedValue({ role: 'super_admin', permissions: [] } as any);
    await expect(guard.canActivate(makeContext({ sub: 'u1' }, PERMISSIONS.ADMINS_MANAGE))).resolves.toBe(true);
  });

  it('denies a role lacking the permission', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(PERMISSIONS.ADMINS_MANAGE);
    adminUserRepo.findById.mockResolvedValue({ role: 'support_agent', permissions: [] } as any);
    await expect(guard.canActivate(makeContext({ sub: 'u1' }, PERMISSIONS.ADMINS_MANAGE))).rejects.toThrow(ForbiddenException);
  });

  it('denies when the admin record no longer exists', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(PERMISSIONS.ADMINS_MANAGE);
    adminUserRepo.findById.mockResolvedValue(null);
    await expect(guard.canActivate(makeContext({ sub: 'gone' }, PERMISSIONS.ADMINS_MANAGE))).rejects.toThrow(ForbiddenException);
  });
});
