import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ScholarshipInteraction, ScholarshipInteractionDocument, ScholarshipInteractionAction,
} from '../models/scholarship-interaction.model';

@Injectable()
export class ScholarshipInteractionService {
  private readonly logger = new Logger('ScholarshipInteractionService');

  constructor(
    @InjectModel(ScholarshipInteraction.name) private readonly model: Model<ScholarshipInteractionDocument>,
  ) {}

  /** Best-effort — interaction logging must never break the calling feature (bookmark, eligibility, browse). */
  async record(userId: string, scholarshipId: string, action: ScholarshipInteractionAction, metadata: Record<string, unknown> = {}): Promise<void> {
    try {
      await this.model.create({ userId, scholarshipId, action, metadata });
    } catch (err) {
      this.logger.warn(`Failed to record scholarship interaction: ${(err as Error).message}`);
    }
  }

  async listForUser(userId: string, limit = 50) {
    return this.model.find({ userId }).sort({ createdAt: -1 }).limit(limit).exec();
  }

  async clear(userId: string): Promise<void> {
    await this.model.deleteMany({ userId }).exec();
  }
}
