import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, LinkedAccountProvider } from '../models/user.model';

@Injectable()
export class UserRepository {
  constructor(@InjectModel(User.name) private readonly model: Model<UserDocument>) {}

  findById(id: string) { return this.model.findById(id).exec(); }
  findByPhone(phone: string) { return this.model.findOne({ phone }).exec(); }
  findByEmail(email: string) { return this.model.findOne({ email: email.toLowerCase() }).exec(); }

  findByLinkedAccount(provider: LinkedAccountProvider, providerId: string) {
    return this.model.findOne({ linkedAccounts: { $elemMatch: { provider, providerId } } }).exec();
  }

  findByExamCode(examCode: string) {
    return this.model.find({ 'examProfiles.examCode': examCode.toUpperCase(), accountStatus: 'active' }).exec();
  }

  /** Students who listed this college among their onboarding preferences — the closest server-side "cares about this college" signal (no saved-colleges bookmark model exists). */
  findByPreferredCollege(collegeId: string) {
    return this.model.find({ 'preferences.preferredColleges': collegeId, accountStatus: 'active' }).exec();
  }

  create(data: Partial<User>) { return this.model.create(data); }

  updateProfile(id: string, fields: Partial<Pick<User, 'fullName' | 'category' | 'domicileState' | 'preferences' | 'familyIncomeAnnual'>>) {
    return this.model.findByIdAndUpdate(id, { $set: fields }, { new: true }).exec();
  }

  /** Atomic add — returns null if the examCode already exists for this user. */
  addExamProfileIfNotExists(id: string, profile: User['examProfiles'][0]) {
    return this.model.findOneAndUpdate(
      { _id: id, 'examProfiles.examCode': { $ne: profile.examCode } },
      { $push: { examProfiles: profile } },
      { new: true },
    ).exec();
  }

  updateExamProfile(id: string, examCode: string, patch: Partial<User['examProfiles'][0]>) {
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) set[`examProfiles.$.${k}`] = v;
    }
    return this.model.findOneAndUpdate(
      { _id: id, 'examProfiles.examCode': examCode },
      { $set: set },
      { new: true },
    ).exec();
  }

  removeExamProfile(id: string, examCode: string) {
    return this.model.findByIdAndUpdate(id, { $pull: { examProfiles: { examCode } } }, { new: true }).exec();
  }

  updateNotificationChannels(id: string, patch: Partial<{ sms: boolean; email: boolean; whatsapp: boolean; push: boolean }>) {
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) set[`notificationChannels.${k}`] = v;
    return this.model.findByIdAndUpdate(id, { $set: set }, { new: true }).exec();
  }

  markEmailPending(id: string, email: string) {
    return this.model.findByIdAndUpdate(id, { email: email.toLowerCase(), isEmailVerified: false }, { new: true }).exec();
  }

  markEmailVerified(id: string) {
    return this.model.findByIdAndUpdate(id, { isEmailVerified: true }, { new: true }).exec();
  }

  // ── Password / account security ─────────────────────────────────────────

  setPasswordHash(id: string, passwordHash: string) {
    return this.model.findByIdAndUpdate(
      id,
      { passwordHash, passwordChangedAt: new Date(), $push: { passwordHistory: { $each: [passwordHash], $slice: -5 } } } as any,
      { new: true },
    ).exec();
  }

  recordLogin(id: string) {
    return this.model.findByIdAndUpdate(id, { lastLoginAt: new Date() }).exec();
  }

  // ── Multi-device sessions ───────────────────────────────────────────────

  addSession(id: string, session: { sessionId: string; refreshTokenHash: string; userAgent?: string; ip?: string }) {
    return this.model.findByIdAndUpdate(
      id,
      { $push: { sessions: { ...session, createdAt: new Date(), lastUsedAt: new Date() } }, lastLoginAt: new Date() },
      { new: true },
    ).exec();
  }

  findBySessionId(sessionId: string) {
    return this.model.findOne({ 'sessions.sessionId': sessionId }).exec();
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

  revokeAllSessions(id: string) {
    return this.model.findByIdAndUpdate(id, { $set: { sessions: [] } }, { new: true }).exec();
  }

  revokeOtherSessions(id: string, keepSessionId: string) {
    return this.model.findByIdAndUpdate(id, { $pull: { sessions: { sessionId: { $ne: keepSessionId } } } }, { new: true }).exec();
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

  async findLocked(page: number, limit: number) {
    const query = { lockedUntil: { $gt: new Date() } };
    const [users, totalResults] = await Promise.all([
      this.model.find(query).skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return { users, totalResults };
  }

  async listActiveSessions(page: number, limit: number) {
    const rows = await this.model.aggregate([
      { $unwind: '$sessions' },
      { $sort: { 'sessions.lastUsedAt': -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: { userId: '$_id', fullName: 1, email: 1, session: '$sessions' } },
    ]).exec();
    const totalResults = await this.model.aggregate([{ $unwind: '$sessions' }, { $count: 'total' }]).exec();
    return { rows, totalResults: totalResults[0]?.total ?? 0 };
  }

  // ── Linked (OAuth) accounts ─────────────────────────────────────────────

  linkAccount(id: string, account: { provider: LinkedAccountProvider; providerId?: string; email?: string }) {
    return this.model.findOneAndUpdate(
      { _id: id, 'linkedAccounts.provider': { $ne: account.provider } },
      { $push: { linkedAccounts: { ...account, linkedAt: new Date() } } },
      { new: true },
    ).exec();
  }

  unlinkAccount(id: string, provider: LinkedAccountProvider) {
    return this.model.findByIdAndUpdate(id, { $pull: { linkedAccounts: { provider } } }, { new: true }).exec();
  }

  // ── Onboarding / extended profile ───────────────────────────────────────

  saveOnboardingStep(id: string, step: number, fields: Record<string, unknown>) {
    return this.model.findByIdAndUpdate(
      id,
      {
        $set: fields,
        $addToSet: { 'onboarding.completedSteps': step },
        'onboarding.currentStep': step,
      },
      { new: true },
    ).exec();
  }

  completeOnboarding(id: string) {
    return this.model.findByIdAndUpdate(
      id,
      { $set: { 'onboarding.completed': true, 'onboarding.completedAt': new Date() } },
      { new: true },
    ).exec();
  }

  /**
   * $unset (not $set: null) for email/phone — both carry a sparse unique
   * index, and a sparse index only excludes documents missing the field
   * entirely. Setting it to `null` still indexes the value, so a second
   * soft-deleted account would collide on "null" and fail to save.
   */
  softDelete(id: string) {
    return this.model.findByIdAndUpdate(
      id,
      {
        $set: { accountStatus: 'deleted', sessions: [], linkedAccounts: [] },
        $unset: { email: '', phone: '', passwordHash: '' },
      },
      { new: true },
    ).exec();
  }

  countAll() {
    return this.model.countDocuments().exec();
  }

  /** Paginated active-student scan — used by the admin broadcast/announcement
   * fan-out so sending to the whole user base doesn't load every document
   * into memory at once. */
  async findActivePage(page: number, limit: number) {
    return this.model.find({ accountStatus: 'active' }).select('_id').skip((page - 1) * limit).limit(limit).exec();
  }
}
