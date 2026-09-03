import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrustedDevice, TrustedDeviceDocument } from '../models/trusted-device.model';
import { SecurityActorType } from '../models/two-factor-auth.model';

@Injectable()
export class TrustedDeviceRepository {
  constructor(@InjectModel(TrustedDevice.name) private readonly model: Model<TrustedDeviceDocument>) {}

  listForUser(userId: string, actorType: SecurityActorType) {
    return this.model.find({ userId, actorType }).sort({ lastSeenAt: -1 }).exec();
  }

  findOne(userId: string, actorType: SecurityActorType, deviceId: string) {
    return this.model.findOne({ userId, actorType, deviceId }).exec();
  }

  async upsertOnLogin(entry: {
    userId: string; actorType: SecurityActorType; deviceId: string;
    browser?: string; os?: string; ip?: string; userAgentRaw?: string; deviceName?: string;
  }): Promise<{ device: TrustedDeviceDocument; isNew: boolean }> {
    const existing = await this.findOne(entry.userId, entry.actorType, entry.deviceId);
    if (existing) {
      existing.lastSeenAt = new Date();
      existing.ip = entry.ip ?? existing.ip;
      await existing.save();
      return { device: existing, isNew: false };
    }
    const device = await this.model.create({ ...entry, firstSeenAt: new Date(), lastSeenAt: new Date() });
    return { device, isNew: true };
  }

  rename(userId: string, actorType: SecurityActorType, deviceId: string, deviceName: string) {
    return this.model.findOneAndUpdate({ userId, actorType, deviceId }, { $set: { deviceName } }, { new: true }).exec();
  }

  setTrusted(userId: string, actorType: SecurityActorType, deviceId: string, isTrusted: boolean) {
    return this.model.findOneAndUpdate({ userId, actorType, deviceId }, { $set: { isTrusted } }, { new: true }).exec();
  }

  remove(userId: string, actorType: SecurityActorType, deviceId: string) {
    return this.model.findOneAndDelete({ userId, actorType, deviceId }).exec();
  }
}
