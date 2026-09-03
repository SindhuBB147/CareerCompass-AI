import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SavedCollege, SavedCollegeDocument, BookmarkStatus } from '../models/saved-college.model';

@Injectable()
export class SavedCollegeRepository {
  constructor(@InjectModel(SavedCollege.name) private readonly model: Model<SavedCollegeDocument>) {}

  listForUser(userId: string) { return this.model.find({ userId }).sort({ createdAt: -1 }).exec(); }
  find(userId: string, collegeId: string) { return this.model.findOne({ userId, collegeId }).exec(); }
  countForUser(userId: string) { return this.model.countDocuments({ userId }).exec(); }

  /** Idempotent — saving an already-saved college is a no-op, not an error. */
  async add(userId: string, collegeId: string) {
    return this.model.findOneAndUpdate(
      { userId, collegeId },
      { $setOnInsert: { userId, collegeId, status: 'interested', notes: [] } },
      { upsert: true, new: true },
    ).exec();
  }

  remove(userId: string, collegeId: string) {
    return this.model.findOneAndDelete({ userId, collegeId }).exec();
  }

  setStatus(userId: string, collegeId: string, status: BookmarkStatus) {
    return this.model.findOneAndUpdate({ userId, collegeId }, { $set: { status } }, { new: true }).exec();
  }

  addNote(userId: string, collegeId: string, note: { id: string; text: string; createdAt: Date }) {
    return this.model.findOneAndUpdate(
      { userId, collegeId },
      { $push: { notes: note } },
      { new: true },
    ).exec();
  }

  removeNote(userId: string, collegeId: string, noteId: string) {
    return this.model.findOneAndUpdate(
      { userId, collegeId },
      { $pull: { notes: { id: noteId } } },
      { new: true },
    ).exec();
  }

  /** Every userId who has this college saved — used to widen the audience of
   * NOTIFICATION_EVENTS.COLLEGE_UPDATED beyond user.preferences.preferredColleges. */
  findUserIdsByCollege(collegeId: string) {
    return this.model.distinct('userId', { collegeId }).exec() as Promise<string[]>;
  }

  countForCollege(collegeId: string) {
    return this.model.countDocuments({ collegeId }).exec();
  }
}
