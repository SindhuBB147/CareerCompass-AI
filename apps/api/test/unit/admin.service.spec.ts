import { AdminService } from '../../src/modules/admin/services/admin.service';
import { AdminUserRepository } from '../../src/modules/auth/repositories/admin-user.repository';
import { PasswordService } from '../../src/modules/auth/services/password.service';
import { DomainException } from '../../src/common/filters/domain.exception';

describe('AdminService — admin account management', () => {
  let userModel: any;
  let adminModel: any;
  let auditModel: { create: jest.Mock };
  let adminUserRepo: jest.Mocked<Pick<AdminUserRepository,
    'findByEmail' | 'create' | 'updateProfile' | 'findById' | 'setPasswordHash' | 'deleteById' | 'list'>>;
  let passwordService: jest.Mocked<Pick<PasswordService, 'hash'>>;
  let service: AdminService;

  beforeEach(() => {
    userModel = {};
    adminModel = {};
    auditModel = { create: jest.fn().mockResolvedValue(undefined) };
    adminUserRepo = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      updateProfile: jest.fn(),
      findById: jest.fn(),
      setPasswordHash: jest.fn(),
      deleteById: jest.fn(),
      list: jest.fn(),
    };
    passwordService = { hash: jest.fn().mockResolvedValue('hashed') };

    service = new AdminService(
      userModel, adminModel, auditModel as any,
      adminUserRepo as unknown as AdminUserRepository,
      passwordService as unknown as PasswordService,
    );
  });

  describe('createAdmin', () => {
    it('rejects a duplicate email', async () => {
      adminUserRepo.findByEmail.mockResolvedValue({ id: 'existing' } as any);
      await expect(service.createAdmin(
        { name: 'A', email: 'a@x.com', password: 'longenoughpw', role: 'data_manager' }, 'actor1',
      )).rejects.toThrow(DomainException);
      expect(adminUserRepo.create).not.toHaveBeenCalled();
    });

    it('hashes the password, creates the admin, applies extra permissions, and records an audit entry', async () => {
      adminUserRepo.findByEmail.mockResolvedValue(null);
      adminUserRepo.create.mockResolvedValue({ id: 'new1' } as any);

      const created = await service.createAdmin(
        { name: 'Ananya', email: 'ananya@x.com', password: 'longenoughpw', role: 'data_manager', permissions: ['cutoffs:resolve'] },
        'actor1', '127.0.0.1',
      );

      expect(passwordService.hash).toHaveBeenCalledWith('longenoughpw');
      expect(adminUserRepo.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'ananya@x.com', role: 'data_manager', fullName: 'Ananya', passwordHash: 'hashed' }));
      expect(adminUserRepo.updateProfile).toHaveBeenCalledWith('new1', { permissions: ['cutoffs:resolve'] });
      expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({ adminId: 'actor1', action: 'admin.create', targetId: 'new1' }));
      expect(created).toEqual({ id: 'new1' });
    });
  });

  describe('updateAdmin', () => {
    it('blocks an admin from deactivating their own account', async () => {
      await expect(service.updateAdmin('actor1', { isActive: false }, 'actor1')).rejects.toThrow(DomainException);
      expect(adminUserRepo.updateProfile).not.toHaveBeenCalled();
    });

    it('allows an admin to update their own non-deactivating fields', async () => {
      adminUserRepo.updateProfile.mockResolvedValue({ id: 'actor1', name: 'New Name' } as any);
      await expect(service.updateAdmin('actor1', { name: 'New Name' }, 'actor1')).resolves.toEqual({ id: 'actor1', name: 'New Name' });
    });

    it('throws NOT_FOUND when the target admin does not exist', async () => {
      adminUserRepo.updateProfile.mockResolvedValue(null);
      await expect(service.updateAdmin('missing', { name: 'X' }, 'actor1')).rejects.toThrow(DomainException);
    });
  });

  describe('deleteAdmin', () => {
    it('blocks self-deletion', async () => {
      await expect(service.deleteAdmin('actor1', 'actor1')).rejects.toThrow(DomainException);
      expect(adminUserRepo.deleteById).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND for a non-existent admin', async () => {
      adminUserRepo.deleteById.mockResolvedValue(null);
      await expect(service.deleteAdmin('missing', 'actor1')).rejects.toThrow(DomainException);
    });

    it('deletes and records an audit entry', async () => {
      adminUserRepo.deleteById.mockResolvedValue({ id: 'victim' } as any);
      await service.deleteAdmin('victim', 'actor1');
      expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.delete', targetId: 'victim' }));
    });
  });

  describe('resetAdminPassword', () => {
    it('throws NOT_FOUND when the admin does not exist', async () => {
      adminUserRepo.findById.mockResolvedValue(null);
      await expect(service.resetAdminPassword('missing', 'actor1')).rejects.toThrow(DomainException);
    });

    it('generates and hashes a temporary password, and records an audit entry', async () => {
      adminUserRepo.findById.mockResolvedValue({ id: 'victim' } as any);
      const result = await service.resetAdminPassword('victim', 'actor1');
      expect(result.temporaryPassword).toEqual(expect.any(String));
      expect(result.temporaryPassword.length).toBeGreaterThan(8);
      expect(adminUserRepo.setPasswordHash).toHaveBeenCalledWith('victim', 'hashed');
      expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.reset_password', targetId: 'victim' }));
    });
  });

  describe('listAdmins', () => {
    it('delegates to the repository with pagination defaults applied by the caller', async () => {
      adminUserRepo.list.mockResolvedValue({ admins: [], totalResults: 0 });
      await service.listAdmins({ role: 'data_manager' }, 2, 10);
      expect(adminUserRepo.list).toHaveBeenCalledWith({ role: 'data_manager' }, 2, 10);
    });
  });
});
