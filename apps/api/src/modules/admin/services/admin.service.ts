import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/models/user.model';
import { AdminUser, AdminUserDocument, AdminRole } from '../../auth/models/admin-user.model';
import { AdminUserRepository } from '../../auth/repositories/admin-user.repository';
import { PasswordService } from '../../auth/services/password.service';
import { AuditLog, AuditLogDocument } from '../../colleges/models/audit-log.model';
import { DomainException } from '../../../common/filters/domain.exception';
import { HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';

export interface UserSearchResult {
  users: UserDocument[];
  totalResults: number;
}

export interface AuditLogFilters {
  targetCollection?: string;
  targetId?: string;
  adminId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AdminUser.name) private readonly adminModel: Model<AdminUserDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
    private readonly adminUserRepo: AdminUserRepository,
    private readonly passwordService: PasswordService,
  ) {}

  // ── User Management ─────────────────────────────────────────────────────────

  async searchUsers(filters: { phone?: string; email?: string; accountStatus?: string }, page = 1, limit = 20): Promise<UserSearchResult> {
    const query: Record<string, unknown> = {};
    if (filters.phone) query.phone = filters.phone;
    if (filters.email) query.email = filters.email;
    if (filters.accountStatus) query.accountStatus = filters.accountStatus;

    const [users, totalResults] = await Promise.all([
      this.userModel.find(query).skip((page - 1) * limit).limit(limit).exec(),
      this.userModel.countDocuments(query).exec(),
    ]);
    return { users, totalResults };
  }

  async updateUserStatus(userId: string, accountStatus: string, reason: string): Promise<UserDocument> {
    if (!['active', 'suspended', 'deleted'].includes(accountStatus)) {
      throw new DomainException('VALIDATION_ERROR', `Invalid status: "${accountStatus}".`, HttpStatus.BAD_REQUEST);
    }

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { accountStatus },
      { new: true },
    ).exec();

    if (!user) throw new DomainException('NOT_FOUND', 'User not found.', HttpStatus.NOT_FOUND);
    return user;
  }

  // ── Audit Logs ──────────────────────────────────────────────────────────────

  async getAuditLogs(filters: AuditLogFilters): Promise<{ logs: AuditLogDocument[]; totalResults: number }> {
    const query: Record<string, unknown> = {};
    if (filters.targetCollection) query.targetCollection = filters.targetCollection;
    if (filters.targetId) query.targetId = filters.targetId;
    if (filters.adminId) query.adminId = filters.adminId;
    if (filters.from || filters.to) {
      query.timestamp = {};
      if (filters.from) (query.timestamp as Record<string, unknown>).$gte = filters.from;
      if (filters.to) (query.timestamp as Record<string, unknown>).$lte = filters.to;
    }

    const [logs, totalResults] = await Promise.all([
      this.auditModel.find(query).sort({ timestamp: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).exec(),
      this.auditModel.countDocuments(query).exec(),
    ]);
    return { logs, totalResults };
  }

  // ── B2B Roster ──────────────────────────────────────────────────────────────
  // Simplified: all active students visible to B2B account managers.
  // Full roster-membership enforcement (checking which students belong to
  // which coaching institute) is a Module 18 expansion once the B2B data
  // model (institute accounts, student-institute mappings) is designed.

  async listRosterStudents(filters?: { examCode?: string }, page = 1, limit = 20): Promise<UserSearchResult> {
    const query: Record<string, unknown> = { accountStatus: 'active' };
    if (filters?.examCode) query['examProfiles.examCode'] = filters.examCode.toUpperCase();

    const [users, totalResults] = await Promise.all([
      this.userModel.find(query).skip((page - 1) * limit).limit(limit).exec(),
      this.userModel.countDocuments(query).exec(),
    ]);
    return { users, totalResults };
  }

  // ── Admin Account Management (Roles & Permissions) ─────────────────────────

  listAdmins(filters: { role?: string; isActive?: boolean; q?: string }, page = 1, limit = 20) {
    return this.adminUserRepo.list(filters, page, limit);
  }

  async createAdmin(
    dto: { name: string; email: string; password: string; role: AdminRole; permissions?: string[] },
    actingAdminId: string,
    ip?: string,
  ): Promise<AdminUserDocument> {
    const existing = await this.adminUserRepo.findByEmail(dto.email);
    if (existing) throw new DomainException('CONFLICT', 'An admin with this email already exists.', HttpStatus.CONFLICT);

    const passwordHash = await this.passwordService.hash(dto.password);
    const created = await this.adminUserRepo.create({
      email: dto.email, passwordHash, role: dto.role, fullName: dto.name,
    });
    if (dto.permissions?.length) {
      await this.adminUserRepo.updateProfile(created.id, { permissions: dto.permissions });
    }
    await this.recordAudit({ adminId: actingAdminId, action: 'admin.create', targetCollection: 'adminusers', targetId: created.id, afterSnapshot: { name: dto.name, email: dto.email, role: dto.role }, ipAddress: ip });
    return created;
  }

  async updateAdmin(
    id: string,
    dto: { name?: string; role?: AdminRole; permissions?: string[]; isActive?: boolean },
    actingAdminId: string,
    ip?: string,
  ): Promise<AdminUserDocument> {
    if (id === actingAdminId && dto.isActive === false) {
      throw new DomainException('VALIDATION_ERROR', 'You cannot deactivate your own admin account.', HttpStatus.BAD_REQUEST);
    }
    const updated = await this.adminUserRepo.updateProfile(id, dto);
    if (!updated) throw new DomainException('NOT_FOUND', 'Admin not found.', HttpStatus.NOT_FOUND);
    await this.recordAudit({ adminId: actingAdminId, action: 'admin.update', targetCollection: 'adminusers', targetId: id, afterSnapshot: dto, ipAddress: ip });
    return updated;
  }

  async resetAdminPassword(id: string, actingAdminId: string, ip?: string): Promise<{ temporaryPassword: string }> {
    const admin = await this.adminUserRepo.findById(id);
    if (!admin) throw new DomainException('NOT_FOUND', 'Admin not found.', HttpStatus.NOT_FOUND);

    const temporaryPassword = crypto.randomBytes(9).toString('base64url');
    const hash = await this.passwordService.hash(temporaryPassword);
    await this.adminUserRepo.setPasswordHash(id, hash);
    await this.recordAudit({ adminId: actingAdminId, action: 'admin.reset_password', targetCollection: 'adminusers', targetId: id, ipAddress: ip });
    return { temporaryPassword };
  }

  async deleteAdmin(id: string, actingAdminId: string, ip?: string): Promise<void> {
    if (id === actingAdminId) {
      throw new DomainException('VALIDATION_ERROR', 'You cannot delete your own admin account.', HttpStatus.BAD_REQUEST);
    }
    const deleted = await this.adminUserRepo.deleteById(id);
    if (!deleted) throw new DomainException('NOT_FOUND', 'Admin not found.', HttpStatus.NOT_FOUND);
    await this.recordAudit({ adminId: actingAdminId, action: 'admin.delete', targetCollection: 'adminusers', targetId: id, ipAddress: ip });
  }

  private async recordAudit(entry: { adminId: string; action: string; targetCollection: string; targetId: string; afterSnapshot?: unknown; ipAddress?: string }): Promise<void> {
    await this.auditModel.create({
      adminId: entry.adminId, action: entry.action, targetCollection: entry.targetCollection, targetId: entry.targetId,
      beforeSnapshot: null, afterSnapshot: entry.afterSnapshot ?? null, ipAddress: entry.ipAddress ?? null, timestamp: new Date(),
    });
  }
}
