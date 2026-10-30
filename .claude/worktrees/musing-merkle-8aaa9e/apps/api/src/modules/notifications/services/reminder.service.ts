import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reminder, ReminderDocument } from '../models/reminder.model';
import { DomainException } from '../../../common/filters/domain.exception';

export interface CreateReminderInput {
  userId: string;
  type: string;
  title: string;
  remindAt: Date;
  note?: string;
  relatedEntityId?: string;
}

@Injectable()
export class ReminderService {
  constructor(@InjectModel(Reminder.name) private readonly model: Model<ReminderDocument>) {}

  create(input: CreateReminderInput): Promise<ReminderDocument> {
    return this.model.create({ ...input, status: 'pending' });
  }

  listForUser(userId: string): Promise<ReminderDocument[]> {
    return this.model.find({ userId, status: 'pending' }).sort({ remindAt: 1 }).exec();
  }

  async cancel(userId: string, reminderId: string): Promise<void> {
    const result = await this.model.updateOne({ _id: reminderId, userId }, { status: 'cancelled' }).exec();
    if (result.matchedCount === 0) throw new DomainException('NOT_FOUND', 'Reminder not found.', HttpStatus.NOT_FOUND);
  }

  /** Reminders due for firing — polled by NotificationSchedulerService. */
  findDue(now = new Date()): Promise<ReminderDocument[]> {
    return this.model.find({ status: 'pending', remindAt: { $lte: now } }).exec();
  }

  markFired(id: string): Promise<void> {
    return this.model.updateOne({ _id: id }, { status: 'fired' }).exec().then(() => undefined);
  }
}
