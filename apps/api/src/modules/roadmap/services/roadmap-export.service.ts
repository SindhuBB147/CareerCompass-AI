import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { Roadmap, RoadmapDocument } from '../models/roadmap.model';
import { DomainException } from '../../../common/filters/domain.exception';

@Injectable()
export class RoadmapExportService {
  constructor(
    @InjectModel(Roadmap.name) private readonly roadmapModel: Model<RoadmapDocument>,
  ) {}

  async enableShare(userId: string): Promise<{ shareToken: string }> {
    const doc = await this.roadmapModel.findOne({ userId, isActive: true }).exec();
    if (!doc) throw new DomainException('NOT_FOUND', 'No active roadmap. Generate one first.', HttpStatus.NOT_FOUND);

    if (!doc.shareToken) {
      doc.shareToken = crypto.randomBytes(16).toString('hex');
    }
    doc.shareEnabled = true;
    await doc.save();
    return { shareToken: doc.shareToken };
  }

  async disableShare(userId: string): Promise<void> {
    await this.roadmapModel.updateOne({ userId, isActive: true }, { $set: { shareEnabled: false } }).exec();
  }

  /** Public, read-only, sanitized projection — no userId, no personal notes. */
  async getShared(shareToken: string) {
    const doc = await this.roadmapModel.findOne({ shareToken, shareEnabled: true }).exec();
    if (!doc) throw new DomainException('NOT_FOUND', 'This shared roadmap link is invalid or has been disabled.', HttpStatus.NOT_FOUND);

    return {
      careerName: doc.careerName,
      generatedAt: doc.generatedAt,
      analytics: doc.analytics,
      phases: doc.phases.map(phase => ({
        phaseKey: phase.phaseKey,
        label: phase.label,
        order: phase.order,
        milestones: phase.milestones.map(m => ({
          title: m.title,
          description: m.description,
          category: m.category,
          difficulty: m.difficulty,
          priority: m.priority,
          status: m.status,
          skills: m.skills,
        })),
      })),
    };
  }
}
