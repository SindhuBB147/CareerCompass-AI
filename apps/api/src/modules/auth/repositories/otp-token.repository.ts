import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OtpToken, OtpTokenDocument } from '../models/otp-token.model';

@Injectable()
export class OtpTokenRepository {
  constructor(@InjectModel(OtpToken.name) private readonly model: Model<OtpTokenDocument>) {}

  create(userId: string, purpose: string, codeHash: string, expiresAt: Date) {
    return this.model.create({ userId, purpose, codeHash, expiresAt, used: false, attempts: 0 });
  }

  findActive(userId: string, purpose: string) {
    return this.model.findOne({ userId, purpose, used: false, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).exec();
  }

  incrementAttempts(id: string) {
    return this.model.findByIdAndUpdate(id, { $inc: { attempts: 1 } }, { new: true }).exec();
  }

  markUsed(id: string) {
    return this.model.findByIdAndUpdate(id, { used: true }).exec();
  }

  invalidateAll(userId: string, purpose: string) {
    return this.model.updateMany({ userId, purpose, used: false }, { used: true }).exec();
  }
}
