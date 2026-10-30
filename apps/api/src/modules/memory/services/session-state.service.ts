import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserSessionState, UserSessionStateDocument } from '../models/user-session-state.model';
import { PatchSessionStateDto } from '../dto/memory.dto';

@Injectable()
export class SessionStateService {
  constructor(
    @InjectModel(UserSessionState.name) private readonly model: Model<UserSessionStateDocument>,
  ) {}

  async getState(userId: string): Promise<UserSessionStateDocument | null> {
    return this.model.findOne({ userId }).exec();
  }

  async patchState(userId: string, patch: PatchSessionStateDto): Promise<UserSessionStateDocument> {
    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) set[key] = value;
    }
    return this.model.findOneAndUpdate({ userId }, { $set: set }, { upsert: true, new: true }).exec();
  }

  async clear(userId: string): Promise<void> {
    await this.model.deleteOne({ userId }).exec();
  }
}
