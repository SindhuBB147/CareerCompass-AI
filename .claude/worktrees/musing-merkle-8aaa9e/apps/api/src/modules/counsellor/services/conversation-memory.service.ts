import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserAiMemory, UserAiMemoryDocument } from '../models/user-ai-memory.model';
import { AiServiceClient } from '../../../common/ai-client/ai-service.client';
import { UserRepository } from '../../users/repositories/user.repository';

export interface RememberedSlots {
  discipline?: string;
  city?: string;
  examCode?: string;
  category?: string;
  budgetMax?: number;
  collegeType?: string;
  hostelRequired?: boolean;
  placementFocus?: boolean;
  scholarshipFocus?: boolean;
  roiFocus?: boolean;
}

/**
 * Extracts structured facts ("CSE", "Bangalore", a budget ceiling) from each
 * AI Counsellor message and remembers them per-user across sessions, so a
 * later "recommend colleges" doesn't lose context an earlier "I want CSE in
 * Bangalore" already established. Reuses ai-service's existing entity
 * extractor (rag/search_entities.py, already wired to Smart Search via
 * AiServiceClient.searchAnalyze) instead of building a second one — see
 * context-aggregator.service.ts for where the remembered slots feed back
 * into the counsellor's response.
 */
@Injectable()
export class ConversationMemoryService {
  private readonly logger = new Logger('ConversationMemoryService');

  constructor(
    @InjectModel(UserAiMemory.name) private readonly memoryModel: Model<UserAiMemoryDocument>,
    private readonly aiServiceClient: AiServiceClient,
    private readonly userRepo: UserRepository,
  ) {}

  /**
   * Extracts entities from `message`, merges any newly-mentioned slots into
   * the user's persisted memory, and returns the full merged slot set for
   * immediate use by the current turn's context aggregation.
   */
  async extractAndMerge(userId: string, sessionId: string, message: string): Promise<RememberedSlots> {
    const user = await this.userRepo.findById(userId);
    if (user?.aiPersonalization?.conversationMemoryEnabled === false) {
      return {};
    }

    const set: Record<string, unknown> = {};
    try {
      const { entities } = await this.aiServiceClient.searchAnalyze(message);
      if (entities.discipline) set['slots.discipline'] = entities.discipline;
      if (entities.city) set['slots.city'] = entities.city;
      if (entities.exam) set['slots.examCode'] = entities.exam;
      if (entities.category) set['slots.category'] = entities.category;
      if (entities.budget_max) set['slots.budgetMax'] = entities.budget_max;
      if (entities.college_type) set['slots.collegeType'] = entities.college_type;
      if (entities.hostel_required) set['slots.hostelRequired'] = true;
      if (entities.placement_focus) set['slots.placementFocus'] = true;
      if (entities.scholarship_focus) set['slots.scholarshipFocus'] = true;
      if (entities.roi_focus) set['slots.roiFocus'] = true;
    } catch (err) {
      // Entity extraction is best-effort context enrichment — a failure here
      // must never break the chat response, just skip this turn's memory update.
      this.logger.warn(`Entity extraction failed, memory not updated for this turn: ${(err as Error).message}`);
    }

    if (Object.keys(set).length > 0) {
      set.lastSourceSessionId = sessionId;
      set.lastUpdatedAt = new Date();
    }

    const doc = Object.keys(set).length > 0
      ? await this.memoryModel.findOneAndUpdate({ userId }, { $set: set }, { upsert: true, new: true }).exec()
      : await this.memoryModel.findOne({ userId }).exec();

    return this.toRememberedSlots(doc?.slots);
  }

  async getSlots(userId: string): Promise<RememberedSlots> {
    const doc = await this.memoryModel.findOne({ userId }).exec();
    return this.toRememberedSlots(doc?.slots);
  }

  async clearSlots(userId: string): Promise<void> {
    await this.memoryModel.deleteOne({ userId }).exec();
  }

  private toRememberedSlots(slots?: UserAiMemory['slots']): RememberedSlots {
    if (!slots) return {};
    return {
      discipline: slots.discipline,
      city: slots.city,
      examCode: slots.examCode,
      category: slots.category,
      budgetMax: slots.budgetMax,
      collegeType: slots.collegeType,
      hostelRequired: slots.hostelRequired,
      placementFocus: slots.placementFocus,
      scholarshipFocus: slots.scholarshipFocus,
      roiFocus: slots.roiFocus,
    };
  }
}
