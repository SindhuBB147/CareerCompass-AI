import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PasswordResetToken, PasswordResetTokenDocument } from '../models/password-reset-token.model';

@Injectable()
export class PasswordResetTokenRepository {
  constructor(@InjectModel(PasswordResetToken.name) private readonly model: Model<PasswordResetTokenDocument>) {}

  create(adminUserId: string, tokenHash: string, expiresAt: Date) {
    return this.model.create({ adminUserId, tokenHash, expiresAt, used: false });
  }

  findValid(adminUserId: string, tokenHash: string) {
    return this.model.findOne({ adminUserId, tokenHash, used: false, expiresAt: { $gt: new Date() } }).exec();
  }

  markUsed(id: string) { return this.model.findByIdAndUpdate(id, { used: true }); }

  invalidateAll(adminUserId: string) {
    return this.model.updateMany({ adminUserId, used: false }, { used: true });
  }
}
