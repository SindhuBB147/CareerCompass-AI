import type { AdminRole } from '../modules/auth/models/admin-user.model';

// Granular capabilities layered on top of the coarse @Roles() role check.
// A role's DEFAULT_ROLE_PERMISSIONS entry is what an admin of that role can
// do out of the box; an individual AdminUser's `permissions[]` field can
// grant additional capabilities beyond their role's defaults (never fewer —
// role still gates route access first via RolesGuard).
export const PERMISSIONS = {
  ADMINS_MANAGE: 'admins:manage',
  COLLEGES_DELETE: 'colleges:delete',
  CUTOFFS_RESOLVE: 'cutoffs:resolve',
  // — Security module —
  SECURITY_MANAGE: 'security:manage',
  SESSIONS_FORCE_LOGOUT: 'sessions:force_logout',
  ACCOUNTS_LOCK_UNLOCK: 'accounts:lock_unlock',
  AUDIT_VIEW: 'audit:view',
  AI_CONFIG_MANAGE: 'ai_config:manage',
  STUDENTS_DELETE: 'students:delete',
  SCHOLARSHIPS_DELETE: 'scholarships:delete',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

// New roles are additive — the 4 pre-existing roles (super_admin,
// data_manager, support_agent, b2b_account_manager) keep exactly the
// permission sets they had before. The 5 new roles below are provisionable
// from the admin panel and gated on the new security endpoints; wiring them
// into every pre-existing module's @Roles() list is a separate, larger
// change outside this module's scope.
export const DEFAULT_ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  data_manager: [PERMISSIONS.COLLEGES_DELETE, PERMISSIONS.CUTOFFS_RESOLVE],
  support_agent: [],
  b2b_account_manager: [],
  counsellor: [],
  moderator: [PERMISSIONS.AUDIT_VIEW],
  data_entry_operator: [],
  content_manager: [],
  ai_manager: [PERMISSIONS.AI_CONFIG_MANAGE],
};

export function hasPermission(role: string, grantedPermissions: string[] | undefined, required: Permission): boolean {
  if (role === 'super_admin') return true;
  if (grantedPermissions?.includes(required)) return true;
  const roleDefaults = DEFAULT_ROLE_PERMISSIONS[role as AdminRole];
  return roleDefaults?.includes(required) ?? false;
}
