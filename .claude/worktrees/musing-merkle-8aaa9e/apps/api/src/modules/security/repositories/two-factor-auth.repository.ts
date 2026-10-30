import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TwoFactorAuth, TwoFactorAuthDocument, SecurityActorType, TwoFactorMethod } from '../models/two-factor-auth.model';

@Injectable()
export class TwoFactorAuthRepository {
  constructor(@InjectModel(TwoFactorAuth.name) private readonly model: Model<TwoFactorAuthDocument>) {}

  findByUser(userId: string, actorType: SecurityActorType) {
    return this.model.findOne({ userId, actorType }).exec();
  }

  async upsertSecret(userId: string, actorType: SecurityActorType, method: TwoFactorMethod, totpSecretEncrypted: string | null) {
    return this.model.findOneAndUpdate(
      { userId, actorType },
      { $set: { method, totpSecretEncrypted, isEnabled: false, enabledAt: null } },
      { new: true, upsert: true },
    ).exec();
  }

  enable(userId: string, actorType: SecurityActorType, recoveryCodeHashes: string[]) {
    return this.model.findOneAndUpdate(
      { userId, actorType },
      { $set: { isEnabled: true, enabledAt: new Date(), recoveryCodes: recoveryCodeHashes.map(codeHash => ({ codeHash, usedAt: null })) } },
      { new: true },
    ).exec();
  }

  disable(userId: string, actorType: SecurityActorType) {
    return this.model.findOneAndUpdate(
      { userId, actorType },
      { $set: { isEnabled: false, enabledAt: null, totpSecretEncrypted: null, recoveryCodes: [], trustedDeviceFingerprints: [] } },
      { new: true },
    ).exec();
  }

  regenerateRecoveryCodes(userId: string, actorType: SecurityActorType, recoveryCodeHashes: string[]) {
    return this.model.findOneAndUpdate(
      { userId, actorType },
      { $set: { recoveryCodes: recoveryCodeHashes.map(codeHash => ({ codeHash, usedAt: null })) } },
      { new: true },
    ).exec();
  }

  markRecoveryCodeUsed(userId: string, actorType: SecurityActorType, codeHash: string) {
    return this.model.findOneAndUpdate(
      { userId, actorType, 'recoveryCodes.codeHash': codeHash },
      { $set: { 'recoveryCodes.$.usedAt': new Date() } },
      { new: true },
    ).exec();
  }

  trustDeviceForTwoFactor(userId: string, actorType: SecurityActorType, fingerprint: string) {
    return this.model.findOneAndUpdate(
      { userId, actorType },
      { $addToSet: { trustedDeviceFingerprints: fingerprint } },
      { new: true },
    ).exec();
  }
}
