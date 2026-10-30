import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as unauthenticated. Every route is protected by the
 * global JwtAuthGuard by default (fail-closed); @Public() is the
 * explicit opt-out.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Declares which admin roles may access a route. Read by RolesGuard,
 * which is registered globally. Any route without @Roles() is accessible
 * by any authenticated caller (student or admin) — @Roles() restricts
 * FURTHER, it doesn't grant access on top of the JWT requirement.
 */
export const ROLES_KEY = 'requiredRoles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Declares which granular permission a route requires, on top of @Roles().
 * Read by PermissionsGuard (registered globally, after RolesGuard). A
 * super_admin always passes; other roles pass if the permission is in their
 * role's default set or explicitly granted on their AdminUser record.
 */
export const PERMISSIONS_KEY = 'requiredPermission';
export const RequirePermissions = (permission: string) => SetMetadata(PERMISSIONS_KEY, permission);

/**
 * Marks a route as high-risk, requiring a fresh step-up "reauth" token
 * (obtained via POST /security/reauth) in the `x-reauth-token` header, on
 * top of the normal JWT. Read by ReauthGuard (modules/security/guards).
 */
export const REQUIRE_REAUTH_KEY = 'requireReauth';
export const RequireReauth = () => SetMetadata(REQUIRE_REAUTH_KEY, true);

/**
 * Declares the SecurityEvent `action` a route should be audit-logged under.
 * Read by SecurityAuditInterceptor (common/interceptors), which records the
 * event after the handler resolves successfully (or the exception filter
 * records a failure — see the interceptor for details).
 */
export const AUDIT_ACTION_KEY = 'auditAction';
export const AuditAction = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
