import { Injectable } from '@nestjs/common';
import { TrustedDeviceRepository } from '../repositories/trusted-device.repository';
import { fingerprintDevice, parseUserAgent, deviceNameFrom } from '../utils/crypto.util';
import { SecurityActorType } from '../models/two-factor-auth.model';
import { DeviceNotFoundException } from '../security.exceptions';

export interface DeviceLoginContext { userId: string; actorType: SecurityActorType; ip?: string; userAgent?: string; }

@Injectable()
export class DeviceService {
  constructor(private readonly repo: TrustedDeviceRepository) {}

  fingerprint(ip?: string, userAgent?: string): string {
    return fingerprintDevice(userAgent, ip);
  }

  /** Called on every successful login — upserts the device record and
   * reports whether this is the first time this device has been seen. */
  async recordLogin(ctx: DeviceLoginContext): Promise<{ deviceId: string; isNewDevice: boolean; deviceName: string }> {
    const deviceId = this.fingerprint(ctx.ip, ctx.userAgent);
    const { browser, os } = parseUserAgent(ctx.userAgent);
    const deviceName = deviceNameFrom(browser, os);
    const { isNew } = await this.repo.upsertOnLogin({
      userId: ctx.userId, actorType: ctx.actorType, deviceId, browser, os,
      ip: ctx.ip, userAgentRaw: ctx.userAgent, deviceName,
    });
    return { deviceId, isNewDevice: isNew, deviceName };
  }

  list(userId: string, actorType: SecurityActorType) {
    return this.repo.listForUser(userId, actorType);
  }

  async rename(userId: string, actorType: SecurityActorType, deviceId: string, deviceName: string) {
    const updated = await this.repo.rename(userId, actorType, deviceId, deviceName);
    if (!updated) throw new DeviceNotFoundException();
    return updated;
  }

  async setTrusted(userId: string, actorType: SecurityActorType, deviceId: string, isTrusted: boolean) {
    const updated = await this.repo.setTrusted(userId, actorType, deviceId, isTrusted);
    if (!updated) throw new DeviceNotFoundException();
    return updated;
  }

  async remove(userId: string, actorType: SecurityActorType, deviceId: string) {
    const removed = await this.repo.remove(userId, actorType, deviceId);
    if (!removed) throw new DeviceNotFoundException();
    return removed;
  }
}
