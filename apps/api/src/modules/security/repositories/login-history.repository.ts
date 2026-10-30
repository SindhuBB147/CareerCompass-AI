import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LoginHistory, LoginHistoryDocument, LoginStatus } from '../models/login-history.model';
import { SecurityActorType } from '../models/two-factor-auth.model';

@Injectable()
export class LoginHistoryRepository {
  constructor(@InjectModel(LoginHistory.name) private readonly model: Model<LoginHistoryDocument>) {}

  record(entry: Omit<LoginHistory, 'timestamp' | 'reportedAsUnknown' | 'location'>) {
    return this.model.create({ ...entry, timestamp: new Date(), reportedAsUnknown: false, location: null });
  }

  async listForUser(userId: string, actorType: SecurityActorType, page: number, limit: number) {
    const query = { userId, actorType };
    const [entries, totalResults] = await Promise.all([
      this.model.find(query).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return { entries, totalResults };
  }

  findById(id: string) { return this.model.findById(id).exec(); }

  reportUnknown(id: string) {
    return this.model.findByIdAndUpdate(id, { $set: { reportedAsUnknown: true } }, { new: true }).exec();
  }

  countRecentFailures(userId: string, actorType: SecurityActorType, sinceMs: number) {
    return this.model.countDocuments({
      userId, actorType, status: 'failed', timestamp: { $gte: new Date(Date.now() - sinceMs) },
    }).exec();
  }

  async listRecentByStatus(status: LoginStatus, page: number, limit: number) {
    const query = { status };
    const [entries, totalResults] = await Promise.all([
      this.model.find(query).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return { entries, totalResults };
  }

  /** Loose "suspicious" heuristic for the admin dashboard: many failures
   * from the same account in a short window, or a login flagged unknown. */
  async listSuspicious(page: number, limit: number) {
    const query = { $or: [{ reportedAsUnknown: true }, { status: 'blocked' }] };
    const [entries, totalResults] = await Promise.all([
      this.model.find(query).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return { entries, totalResults };
  }

  async loginTrends(days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.model.aggregate([
      { $match: { timestamp: { $gte: since } } },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, status: '$status' }, count: { $sum: 1 } } },
      { $sort: { '_id.day': 1 } },
    ]).exec();
  }

  async distributionBy(field: 'browser' | 'os' | 'deviceName', days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.model.aggregate([
      { $match: { timestamp: { $gte: since }, status: 'success' } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).exec();
  }
}
