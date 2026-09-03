import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GeneratedReport, GeneratedReportDocument } from '../models/report.model';

@Injectable()
export class ReportRepository {
  constructor(@InjectModel(GeneratedReport.name) private readonly model: Model<GeneratedReportDocument>) {}

  create(fields: Partial<GeneratedReport>) { return this.model.create(fields); }

  findByIdForUser(userId: string, id: string) { return this.model.findOne({ _id: id, userId }).exec(); }

  listForUser(userId: string, page: number, limit: number) {
    return this.model.find({ userId }).sort({ generatedAt: -1 }).skip((page - 1) * limit).limit(limit).exec();
  }

  countForUser(userId: string) { return this.model.countDocuments({ userId }).exec(); }

  findByShareToken(token: string) { return this.model.findOne({ shareToken: token, shareEnabled: true }).exec(); }

  incrementDownloadCount(id: string) {
    return this.model.updateOne({ _id: id }, { $inc: { downloadCount: 1 } }).exec();
  }

  deleteForUser(userId: string, id: string) {
    return this.model.findOneAndDelete({ _id: id, userId }).exec();
  }
}
