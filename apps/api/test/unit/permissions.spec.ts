import { hasPermission, PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSIONS } from '../../src/common/permissions';

describe('permissions', () => {
  describe('hasPermission', () => {
    it('always allows super_admin, regardless of granted permissions', () => {
      expect(hasPermission('super_admin', [], PERMISSIONS.ADMINS_MANAGE)).toBe(true);
      expect(hasPermission('super_admin', undefined, PERMISSIONS.CUTOFFS_RESOLVE)).toBe(true);
    });

    it('allows a role via its default permission set even with no explicit grants', () => {
      expect(hasPermission('data_manager', [], PERMISSIONS.COLLEGES_DELETE)).toBe(true);
      expect(hasPermission('data_manager', undefined, PERMISSIONS.CUTOFFS_RESOLVE)).toBe(true);
    });

    it('denies a role for a permission outside its defaults and not explicitly granted', () => {
      expect(hasPermission('data_manager', [], PERMISSIONS.ADMINS_MANAGE)).toBe(false);
      expect(hasPermission('support_agent', [], PERMISSIONS.COLLEGES_DELETE)).toBe(false);
    });

    it('allows via an explicit grant beyond the role default', () => {
      expect(hasPermission('support_agent', [PERMISSIONS.COLLEGES_DELETE], PERMISSIONS.COLLEGES_DELETE)).toBe(true);
    });

    it('super_admin default permissions cover every defined permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.super_admin.sort()).toEqual([...ALL_PERMISSIONS].sort());
    });
  });
});
