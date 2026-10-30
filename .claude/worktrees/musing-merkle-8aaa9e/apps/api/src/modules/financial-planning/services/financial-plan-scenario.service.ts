import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinancialPlanScenario, FinancialPlanScenarioDocument } from '../models/financial-plan-scenario.model';

const HISTORY_LIMIT = 20;

@Injectable()
export class FinancialPlanScenarioService {
  private readonly logger = new Logger('FinancialPlanScenarioService');

  constructor(
    @InjectModel(FinancialPlanScenario.name) private readonly model: Model<FinancialPlanScenarioDocument>,
  ) {}

  /** Best-effort — a persistence failure must never break the calculation response. */
  async saveScenario(userId: string, type: 'dashboard' | 'comparison', input: Record<string, unknown>, resultSummary: Record<string, unknown>): Promise<void> {
    try {
      await this.model.create({ userId, type, input, resultSummary });
    } catch (err) {
      this.logger.warn(`Failed to persist financial plan scenario: ${(err as Error).message}`);
    }
  }

  async listHistory(userId: string, limit = HISTORY_LIMIT) {
    return this.model.find({ userId }).sort({ createdAt: -1 }).limit(limit).exec();
  }

  async clear(userId: string): Promise<void> {
    await this.model.deleteMany({ userId }).exec();
  }
}
