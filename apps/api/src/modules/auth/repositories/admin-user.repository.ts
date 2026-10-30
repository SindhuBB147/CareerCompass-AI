import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdminUser, AdminUserDocument } from '../models/admin-user.model';

export interface AdminUserListFilters {
  role?: string;
  isActive?: boolean;
  q?: string;
}

@Injectable()
export class AdminUserRepository {
  constructor(@InjectModel(AdminUser.name) private readonly model: Model<AdminUserDocument>) {}

  findByEmail(email: string) { return this.model.findOne({ email: email.toLowerCase() }).exec(); }
  findById(id: string) { return this.model.findById(id).exec(); }

  create(data: { email: string; passwordHash: string; role: string; fullName: string; isActive?: boolean }) {
    return this.model.create({
      name: data.fullName,
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      role: data.role,
      isActive: data.isActive ?? true,
    });
  }

  updatePasswordAndRevokeSessions(id: string, hash: string) {
    return this.model.findByIdAndUpdate(id, {
      passwordHash: hash,
      currentRefreshTokenHash: null,
      sessions: [],
      passwordChangedAt: new Date(),
      $push: { passwordHistory: { $each: [hash], $slice: -5 } },
    } as any);
  }

  recordLoginAndRotateRefreshToken(id: string, hash: string) {
    return this.model.findByIdAndUpdate(id, { currentRefreshTokenHash: hash, lastLoginAt: new Date() });
  }

  updateRefreshTokenHash(id: string, hash: string | null) {
    return this.model.findByIdAndUpdate(id, { currentRefreshTokenHash: hash });
  }

  // ── Multi-device sessions (mirrors UserRepository's session methods) ────────

  addSession(id: string, session: { sessionId: string; refreshTokenHash: string; userAgent?: string; ip?: string }) {
    return this.model.findByIdAndUpdate(
      id,
      { $push: { sessions: { ...session, createdAt: new Date(), lastUsedAt: new Date() } }, lastLoginAt: new Date() },
      { new: true },
    ).exec();
  }

  rotateSession(id: string, sessionId: string, newRefreshTokenHash: string) {
    return this.model.findOneAndUpdate(
      { _id: id, 'sessions.sessionId': sessionId },
      { $set: { 'sessions.$.refreshTokenHash': newRefreshTokenHash, 'sessions.$.lastUsedAt': new Date() } },
      { new: true },
    ).exec();
  }

  revokeSession(id: string, sessionId: string) {
    return this.model.findByIdAndUpdate(id, { $pull: { sessions: { sessionId } } }, { new: true }).exec();
  }

  revokeOtherSessions(id: string, keepSessionId: string) {
    return this.model.findByIdAndUpdate(id, { $pull: { sessions: { sessionId: { $ne: keepSessionId } } } }, { new: true }).exec();
  }

  revokeAllSessions(id: string) {
    return this.model.findByIdAndUpdate(id, { $set: { sessions: [] } }, { new: true }).exec();
  }

  // ── Account security ─────────────────────────────────────────────────────

  setLockedUntil(id: string, lockedUntil: Date | null) {
    return this.model.findByIdAndUpdate(id, { $set: { lockedUntil } }, { new: true }).exec();
  }

  setTwoFactorEnabled(id: string, enabled: boolean, method: string | null = null) {
    const set: Record<string, unknown> = { twoFactorEnabled: enabled, twoFactorMethod: enabled ? method : null };
    if (!enabled) set.twoFactorTrustedDeviceFingerprints = [];
    return this.model.findByIdAndUpdate(id, { $set: set }, { new: true }).exec();
  }

  async incrementFailedLoginCount(id: string): Promise<number> {
    const updated = await this.model.findByIdAndUpdate(id, { $inc: { failedLoginCount: 1 } }, { new: true }).exec();
    return updated?.failedLoginCount ?? 0;
  }

  resetFailedLoginCount(id: string) {
    return this.model.findByIdAndUpdate(id, { $set: { failedLoginCount: 0 } }).exec();
  }

  addTrustedTwoFactorFingerprint(id: string, fingerprint: string) {
    return this.model.findByIdAndUpdate(id, { $addToSet: { twoFactorTrustedDeviceFingerprints: fingerprint } }).exec();
  }

  setActive(id: string, isActive: boolean) {
    return this.model.findByIdAndUpdate(id, { $set: { isActive } }, { new: true }).exec();
  }

  async findLocked(page: number, limit: number) {
    const query = { lockedUntil: { $gt: new Date() } };
    const [admins, totalResults] = await Promise.all([
      this.model.find(query).select('-passwordHash').skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return { admins, totalResults };
  }

  async listActiveSessions(page: number, limit: number) {
    const rows = await this.model.aggregate([
      { $unwind: '$sessions' },
      { $sort: { 'sessions.lastUsedAt': -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: { userId: '$_id', fullName: '$name', email: 1, session: '$sessions' } },
    ]).exec();
    const totalResults = await this.model.aggregate([{ $unwind: '$sessions' }, { $count: 'total' }]).exec();
    return { rows, totalResults: totalResults[0]?.total ?? 0 };
  }

  // ── Admin account management ────────────────────────────────────────────────

  async list(filters: AdminUserListFilters, page: number, limit: number) {
    const query: Record<string, unknown> = {};
    if (filters.role) query.role = filters.role;
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    if (filters.q) query.$or = [
      { name: { $regex: filters.q, $options: 'i' } },
      { email: { $regex: filters.q, $options: 'i' } },
    ];

    const [admins, totalResults] = await Promise.all([
      this.model.find(query).select('-passwordHash -currentRefreshTokenHash').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return { admins, totalResults };
  }

  updateProfile(id: string, patch: { name?: string; role?: string; permissions?: string[]; isActive?: boolean }) {
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) set[k] = v;
    return this.model.findByIdAndUpdate(id, { $set: set }, { new: true }).select('-passwordHash -currentRefreshTokenHash').exec();
  }

  setPasswordHash(id: string, passwordHash: string) {
    return this.model.findByIdAndUpdate(id, { passwordHash, currentRefreshTokenHash: null }, { new: true }).exec();
  }

  deleteById(id: string) {
    return this.model.findByIdAndDelete(id).exec();
  }

  countAll() {
    return this.model.countDocuments().exec();
  }
}
