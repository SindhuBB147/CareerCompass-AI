import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/models/user.model';
import { Prediction, PredictionDocument } from '../../predictions/models/prediction.model';
import { Cutoff, CutoffDocument } from '../../cutoffs/models/cutoff.model';
import { Notification, NotificationDocument } from '../../notifications/models/notification.model';

export interface PlatformReport {
  generatedAt: Date;
  period: { from: Date; to: Date };
  userMetrics: {
    totalRegistered: number;
    activeInPeriod: number;
    newRegistrations: number;
    byExam: Array<{ examCode: string; count: number }>;
    byCategory: Array<{ category: string; count: number }>;
  };
  predictionMetrics: {
    totalComputed: number;
    bandDistribution: Array<{ band: string; count: number }>;
  };
  notificationMetrics: {
    totalSent: number;
    deliverySuccessRate: number;
    byChannel: Array<{ channel: string; count: number }>;
  };
  cutoffMetrics: {
    totalRecords: number;
    byExam: Array<{ examCode: string; count: number }>;
    conflictsOpen: number;
    conflictsResolved: number;
  };
}

export interface CohortReport {
  examCode: string;
  totalStudents: number;
  rankDistribution: Array<{ bucket: string; count: number }>;
  topShortlistedColleges: Array<{ collegeId: string; count: number }>;
}

@Injectable()
export class ReportingService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Prediction.name) private readonly predModel: Model<PredictionDocument>,
    @InjectModel(Cutoff.name) private readonly cutoffModel: Model<CutoffDocument>,
    @InjectModel(Notification.name) private readonly notifModel: Model<NotificationDocument>,
  ) {}

  async generatePlatformReport(from: Date, to: Date): Promise<PlatformReport> {
    const [
      totalRegistered, activeInPeriod, newRegistrations,
      byExam, byCategory,
      totalPredictions, bandDistribution,
      totalNotifications, sentNotifications, byChannel,
      totalCutoffs, cutoffsByExam,
    ] = await Promise.all([
      this.userModel.countDocuments({ accountStatus: 'active' }),
      this.userModel.countDocuments({ updatedAt: { $gte: from, $lte: to }, accountStatus: 'active' }),
      this.userModel.countDocuments({ createdAt: { $gte: from, $lte: to } }),
      this.userModel.aggregate([
        { $unwind: '$examProfiles' },
        { $group: { _id: '$examProfiles.examCode', count: { $sum: 1 } } },
        { $project: { _id: 0, examCode: '$_id', count: 1 } },
      ]),
      this.userModel.aggregate([
        { $match: { category: { $ne: null } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $project: { _id: 0, category: '$_id', count: 1 } },
      ]),
      this.predModel.countDocuments({ computedAt: { $gte: from, $lte: to } }),
      this.predModel.aggregate([
        { $match: { computedAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$probabilityBand', count: { $sum: 1 } } },
        { $project: { _id: 0, band: '$_id', count: 1 } },
      ]),
      this.notifModel.countDocuments({ createdAt: { $gte: from, $lte: to } }),
      this.notifModel.countDocuments({ createdAt: { $gte: from, $lte: to }, status: 'sent' }),
      this.notifModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $unwind: '$channels' },
        { $group: { _id: '$channels', count: { $sum: 1 } } },
        { $project: { _id: 0, channel: '$_id', count: 1 } },
      ]),
      this.cutoffModel.countDocuments(),
      this.cutoffModel.aggregate([
        { $group: { _id: '$examCode', count: { $sum: 1 } } },
        { $project: { _id: 0, examCode: '$_id', count: 1 } },
      ]),
    ]);

    return {
      generatedAt: new Date(),
      period: { from, to },
      userMetrics: { totalRegistered, activeInPeriod, newRegistrations, byExam, byCategory },
      predictionMetrics: { totalComputed: totalPredictions, bandDistribution },
      notificationMetrics: {
        totalSent: totalNotifications,
        deliverySuccessRate: totalNotifications > 0 ? Math.round((sentNotifications / totalNotifications) * 100) / 100 : 0,
        byChannel,
      },
      cutoffMetrics: { totalRecords: totalCutoffs, byExam: cutoffsByExam, conflictsOpen: 0, conflictsResolved: 0 },
    };
  }

  async generateCohortReport(examCode: string): Promise<CohortReport> {
    const code = examCode.toUpperCase();
    const students = await this.userModel.find({
      'examProfiles.examCode': code, accountStatus: 'active',
    }).exec();

    const ranks = students
      .map(s => s.examProfiles?.find(ep => ep.examCode === code)?.rank)
      .filter((r): r is number => r !== undefined);

    const buckets = [
      { label: '1-1000', min: 1, max: 1000 },
      { label: '1001-5000', min: 1001, max: 5000 },
      { label: '5001-10000', min: 5001, max: 10000 },
      { label: '10001-25000', min: 10001, max: 25000 },
      { label: '25001-50000', min: 25001, max: 50000 },
      { label: '50001+', min: 50001, max: Infinity },
    ];

    const rankDistribution = buckets.map(b => ({
      bucket: b.label,
      count: ranks.filter(r => r >= b.min && r <= b.max).length,
    }));

    return {
      examCode: code,
      totalStudents: students.length,
      rankDistribution,
      topShortlistedColleges: [], // Requires shortlist collection — added when Module 10's shortlist integration is wired
    };
  }
}
