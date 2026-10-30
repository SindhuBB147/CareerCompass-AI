import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SecurityEvent, SecurityEventDocument, SecurityEventAction } from '../models/security-event.model';

export interface SecurityEventFilters {
  actorId?: string;
  action?: SecurityEventAction;
  result?: 'success' | 'failure';
  from?: Date;
  to?: Date;
}

@Injectable()
export class SecurityEventRepository {
  constructor(@InjectModel(SecurityEvent.name) private readonly model: Model<SecurityEventDocument>) {}

  record(entry: Omit<SecurityEvent, 'timestamp'>) {
    return this.model.create({ ...entry, timestamp: new Date() });
  }

  async list(filters: SecurityEventFilters, page: number, limit: number) {
    const query: Record<string, unknown> = {};
    if (filters.actorId) query.actorId = filters.actorId;
    if (filters.action) query.action = filters.action;
    if (filters.result) query.result = filters.result;
    if (filters.from || filters.to) {
      query.timestamp = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    }
    const [events, totalResults] = await Promise.all([
      this.model.find(query).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return { events, totalResults };
  }

  recentForUser(actorId: string, limit = 10) {
    return this.model.find({ actorId }).sort({ timestamp: -1 }).limit(limit).exec();
  }
}
