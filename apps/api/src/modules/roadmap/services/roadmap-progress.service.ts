import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Roadmap, RoadmapDocument } from '../models/roadmap.model';
import { DomainException } from '../../../common/filters/domain.exception';
import { MilestoneStatus } from '../roadmap.types';
import { applyDependencyLocks, computeAnalytics } from '../utils/roadmap.util';
import { UserRepository } from '../../users/repositories/user.repository';
import { NOTIFICATION_EVENTS } from '../../notifications/events/notification.events';

export interface MilestoneUpdatePatch {
  status?: MilestoneStatus;
  notes?: string;
}

@Injectable()
export class RoadmapProgressService {
  constructor(
    @InjectModel(Roadmap.name) private readonly roadmapModel: Model<RoadmapDocument>,
    private readonly userRepo: UserRepository,
    private readonly events: EventEmitter2,
  ) {}

  async updateMilestone(userId: string, milestoneKey: string, patch: MilestoneUpdatePatch): Promise<RoadmapDocument> {
    const doc = await this.roadmapModel.findOne({ userId, isActive: true }).exec();
    if (!doc) throw new DomainException('NOT_FOUND', 'No active roadmap. Generate one first.', HttpStatus.NOT_FOUND);

    const milestone = doc.phases.flatMap(p => p.milestones).find(m => m.milestoneKey === milestoneKey);
    if (!milestone) throw new DomainException('NOT_FOUND', `Milestone "${milestoneKey}" not found on your roadmap.`, HttpStatus.NOT_FOUND);

    if (patch.status) {
      if (patch.status === 'completed' || patch.status === 'in_progress') {
        const completedKeys = new Set(doc.phases.flatMap(p => p.milestones).filter(m => m.status === 'completed').map(m => m.milestoneKey));
        const blocked = milestone.dependsOn.some(dep => !completedKeys.has(dep));
        if (blocked) {
          throw new DomainException('MILESTONE_LOCKED', 'Complete its prerequisite milestones first.', HttpStatus.BAD_REQUEST);
        }
      }

      const wasInProgress = milestone.status === 'in_progress';
      milestone.status = patch.status;
      if (patch.status === 'in_progress' && !milestone.startedAt) milestone.startedAt = new Date();
      if (patch.status === 'completed') milestone.completedAt = new Date();
      else milestone.completedAt = null;

      if (patch.status === 'in_progress' && !wasInProgress) {
        await this.scheduleProgressReminder(userId, milestone);
      }
      if (patch.status === 'completed') {
        this.events.emit(NOTIFICATION_EVENTS.ROADMAP_MILESTONE_COMPLETED, {
          userId, milestoneKey: milestone.milestoneKey, milestoneTitle: milestone.title, roadmapId: doc.id,
        });
      }
    }

    if (patch.notes !== undefined) milestone.notes = patch.notes;

    applyDependencyLocks(doc.phases as any);
    doc.analytics = computeAnalytics(doc.phases as any, doc.generatedAt) as any;
    doc.markModified('phases');
    doc.markModified('analytics');
    await doc.save();

    return doc;
  }

  async getActiveAnalytics(userId: string) {
    const doc = await this.roadmapModel.findOne({ userId, isActive: true }).exec();
    if (!doc) throw new DomainException('NOT_FOUND', 'No active roadmap. Generate one first.', HttpStatus.NOT_FOUND);
    return doc.analytics;
  }

  private async scheduleProgressReminder(userId: string, milestone: { milestoneKey: string; title: string; estimatedWeeks: number; reminderSet: boolean }): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.aiPersonalization?.receiveNotifications === false) return;

    const checkInDays = Math.max(7, Math.min(milestone.estimatedWeeks * 7, 60));
    this.events.emit(NOTIFICATION_EVENTS.ROADMAP_MILESTONE_CHECK_IN, {
      userId,
      milestoneKey: milestone.milestoneKey,
      milestoneTitle: milestone.title,
      checkInAt: new Date(Date.now() + checkInDays * 24 * 60 * 60 * 1000),
    });
    milestone.reminderSet = true;
  }
}
