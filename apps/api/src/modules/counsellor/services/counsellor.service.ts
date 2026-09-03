import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { Response as ExpressResponse } from 'express';
import { AiConversation, AiConversationDocument } from '../models/ai-conversation.model';
import { AiUsageLog, AiUsageLogDocument } from '../models/ai-usage-log.model';
import { AiFeedback, AiFeedbackDocument } from '../models/ai-feedback.model';
import { ContextAggregatorService } from './context-aggregator.service';
import { ConversationMemoryService } from './conversation-memory.service';
import { AiServiceClient, ConversationTurn, RagQueryResponse } from '../../../common/ai-client/ai-service.client';
import { FeedbackDto } from '../dto/counsellor.dto';
import { DomainException } from '../../../common/filters/domain.exception';
import { HttpStatus } from '@nestjs/common';
import { maskPii } from '../../../common/utils/pii';

export interface Citation {
  tag: string;
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
}

export interface ChatResponseMessage {
  role: 'assistant';
  content: string;
  reasoning?: string;
  intent?: string;
  confidenceScore?: number;
  confidenceLevel?: string;
  lowConfidence: boolean;
  sourcesCited: Citation[];
  structuredSources: Array<{ type: string; id: string; title: string }>;
  suggestedQuestions: string[];
  relatedColleges: string[];
  actionButtons: RagQueryResponse['action_buttons'];
  provider?: string;
  timestamp: Date;
}

const MAX_HISTORY_TURNS = 6;

/**
 * Orchestrates the AI Counsellor: owns session lifecycle, per-user
 * isolation, and conversation memory (Mongo). Delegates structured-context
 * gathering to ContextAggregatorService and the actual RAG pipeline
 * (retrieval, prompting, LLM call, validation) to the Python ai-service via
 * AiServiceClient — see architecture notes in those files.
 */
@Injectable()
export class CounsellorService {
  constructor(
    @InjectModel(AiConversation.name) private readonly convModel: Model<AiConversationDocument>,
    @InjectModel(AiUsageLog.name) private readonly usageModel: Model<AiUsageLogDocument>,
    @InjectModel(AiFeedback.name) private readonly feedbackModel: Model<AiFeedbackDocument>,
    private readonly contextAggregator: ContextAggregatorService,
    private readonly conversationMemory: ConversationMemoryService,
    private readonly aiServiceClient: AiServiceClient,
  ) {}

  async startSession(userId: string, initialMessage?: string): Promise<{ sessionId: string; status: string; firstMessage?: ChatResponseMessage }> {
    const sessionId = `sess_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await this.convModel.create({
      userId, sessionId, messages: [], startedAt: new Date(), status: 'active',
    });

    let firstMessage: ChatResponseMessage | undefined;
    if (initialMessage) {
      firstMessage = await this.sendMessage(userId, sessionId, initialMessage);
    }

    return { sessionId, status: 'active', firstMessage };
  }

  async sendMessage(userId: string, sessionId: string, content: string): Promise<ChatResponseMessage> {
    const conv = await this.findActiveConversation(userId, sessionId);
    const startedAt = Date.now();

    conv.messages.push({ role: 'user', content, sourcesCited: [], timestamp: new Date() } as any);
    if (!conv.title) conv.title = content.slice(0, 80);

    const rememberedSlots = await this.conversationMemory.extractAndMerge(userId, sessionId, content);
    const { studentContext, structuredContext } = await this.contextAggregator.gather(userId, content, rememberedSlots);
    const history = this.recentHistory(conv);

    let ragResponse: RagQueryResponse;
    try {
      ragResponse = await this.aiServiceClient.query({
        query: content,
        session_id: sessionId,
        student_context: studentContext,
        structured_context: structuredContext,
        conversation_history: history,
      });
    } catch (err) {
      await this.logUsage(userId, sessionId, content, null, Date.now() - startedAt, true);
      throw err;
    }

    const assistantMsg = this.toAssistantMessage(ragResponse);
    conv.messages.push(assistantMsg as any);
    conv.lastMessageAt = assistantMsg.timestamp;
    if (ragResponse.low_confidence) conv.flaggedForReview = true;
    await conv.save();

    await this.logUsage(userId, sessionId, content, ragResponse, Date.now() - startedAt, false);

    return assistantMsg;
  }

  /**
   * Streams the assistant's answer over SSE straight from ai-service, then
   * persists the completed message once the stream ends.
   */
  async sendMessageStream(userId: string, sessionId: string, content: string, res: ExpressResponse): Promise<void> {
    const conv = await this.findActiveConversation(userId, sessionId);
    const startedAt = Date.now();

    conv.messages.push({ role: 'user', content, sourcesCited: [], timestamp: new Date() } as any);
    if (!conv.title) conv.title = content.slice(0, 80);
    await conv.save();

    const rememberedSlots = await this.conversationMemory.extractAndMerge(userId, sessionId, content);
    const { studentContext, structuredContext } = await this.contextAggregator.gather(userId, content, rememberedSlots);
    const history = this.recentHistory(conv);

    let donePayload: Record<string, unknown> | null;
    try {
      donePayload = await this.aiServiceClient.streamQuery(
        {
          query: content, session_id: sessionId, student_context: studentContext,
          structured_context: structuredContext, conversation_history: history,
        },
        res,
      );
    } catch (err) {
      await this.logUsage(userId, sessionId, content, null, Date.now() - startedAt, true);
      throw err;
    }

    if (!donePayload) return; // client disconnected or stream produced no final frame

    const ragResponse = donePayload as unknown as RagQueryResponse & { answer: string };
    const assistantMsg = this.toAssistantMessage({ ...ragResponse, model: (ragResponse as any).provider ?? 'unknown' } as RagQueryResponse);

    const freshConv = await this.convModel.findOne({ sessionId, userId }).exec();
    if (freshConv) {
      freshConv.messages.push(assistantMsg as any);
      freshConv.lastMessageAt = assistantMsg.timestamp;
      if (ragResponse.low_confidence) freshConv.flaggedForReview = true;
      await freshConv.save();
    }

    await this.logUsage(userId, sessionId, content, ragResponse, Date.now() - startedAt, false);
  }

  async getSession(userId: string, sessionId: string): Promise<AiConversationDocument> {
    const conv = await this.convModel.findOne({ sessionId, userId }).exec();
    if (!conv) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Session not found.' });
    return conv;
  }

  async listSessions(userId: string): Promise<Array<{ sessionId: string; title?: string; status: string; lastMessageAt?: Date; startedAt: Date }>> {
    const convs = await this.convModel
      .find({ userId })
      .select('sessionId title status lastMessageAt startedAt')
      .sort({ lastMessageAt: -1, startedAt: -1 })
      .exec();
    return convs.map(c => ({
      sessionId: c.sessionId, title: c.title, status: c.status, lastMessageAt: c.lastMessageAt, startedAt: c.startedAt,
    }));
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.convModel.deleteOne({ sessionId, userId }).exec();
    if (result.deletedCount === 0) {
      throw new DomainException('NOT_FOUND', 'Session not found.', HttpStatus.NOT_FOUND);
    }
  }

  /** AI Conversation Memory — bulk clear ("Delete Conversation History") for the Memory & Privacy page. */
  async deleteAllSessions(userId: string): Promise<void> {
    await this.convModel.deleteMany({ userId }).exec();
  }

  async submitFeedback(userId: string, dto: FeedbackDto): Promise<void> {
    const conv = await this.convModel.findOne({ sessionId: dto.sessionId, userId }).exec();
    if (!conv) throw new DomainException('NOT_FOUND', 'Session not found.', HttpStatus.NOT_FOUND);
    if (!conv.messages[dto.messageIndex] || conv.messages[dto.messageIndex].role !== 'assistant') {
      throw new DomainException('UNPROCESSABLE', 'That message cannot receive feedback.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    await this.feedbackModel.findOneAndUpdate(
      { userId, sessionId: dto.sessionId, messageIndex: dto.messageIndex },
      { rating: dto.rating, comment: dto.comment },
      { upsert: true },
    ).exec();
  }

  async listFlaggedSessions(): Promise<AiConversationDocument[]> {
    return this.convModel.find({ flaggedForReview: true }).sort({ lastMessageAt: -1 }).exec();
  }

  async getUsageSummary(): Promise<Record<string, unknown>> {
    const [totals] = await this.usageModel.aggregate([
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          avgConfidence: { $avg: '$confidenceScore' },
          avgLatencyMs: { $avg: '$latencyMs' },
          lowConfidenceCount: { $sum: { $cond: ['$lowConfidence', 1, 0] } },
          erroredCount: { $sum: { $cond: ['$errored', 1, 0] } },
        },
      },
    ]).exec();

    const byIntent = await this.usageModel.aggregate([
      { $group: { _id: '$intent', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).exec();

    return {
      totalRequests: totals?.totalRequests ?? 0,
      avgConfidence: totals?.avgConfidence ?? null,
      avgLatencyMs: totals?.avgLatencyMs ?? null,
      lowConfidenceRate: totals?.totalRequests ? (totals.lowConfidenceCount / totals.totalRequests) : 0,
      erroredRate: totals?.totalRequests ? (totals.erroredCount / totals.totalRequests) : 0,
      byIntent: byIntent.map(b => ({ intent: b._id ?? 'unknown', count: b.count })),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findActiveConversation(userId: string, sessionId: string): Promise<AiConversationDocument> {
    const conv = await this.convModel.findOne({ sessionId, userId, status: 'active' }).exec();
    if (!conv) throw new DomainException('NOT_FOUND', 'Session not found or already closed.', HttpStatus.NOT_FOUND);
    return conv;
  }

  private recentHistory(conv: AiConversationDocument): ConversationTurn[] {
    return conv.messages
      .slice(-MAX_HISTORY_TURNS)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }

  private toAssistantMessage(rag: RagQueryResponse & { answer?: string }): ChatResponseMessage {
    // ai-service (Python) returns snake_case field names; everything Nest
    // persists/returns is camelCase, matching both the Mongoose schema
    // (models/ai-conversation.model.ts) and the rest of this API's
    // response conventions — so every ai-service field is remapped here,
    // once, rather than leaking snake_case into Mongo or the frontend.
    const sourcesCited: Citation[] = (rag.sources_cited ?? []).map(s => ({
      tag: s.tag, sourceType: s.source_type, sourceId: s.source_id, title: s.title, snippet: s.snippet,
    }));

    return {
      role: 'assistant',
      content: rag.answer,
      reasoning: rag.reasoning,
      intent: rag.intent,
      confidenceScore: rag.confidence_score,
      confidenceLevel: rag.confidence_level,
      lowConfidence: rag.low_confidence,
      sourcesCited,
      structuredSources: sourcesCited
        .filter(s => s.sourceType !== 'document')
        .map(s => ({ type: s.sourceType, id: s.sourceId, title: s.title })),
      suggestedQuestions: rag.suggested_questions ?? [],
      relatedColleges: rag.related_colleges ?? [],
      actionButtons: rag.action_buttons ?? [],
      provider: rag.provider,
      timestamp: new Date(),
    };
  }

  private async logUsage(
    userId: string, sessionId: string, query: string,
    rag: RagQueryResponse | null, latencyMs: number, errored: boolean,
  ): Promise<void> {
    try {
      await this.usageModel.create({
        userId, sessionId, queryMasked: maskPii(query),
        intent: rag?.intent, provider: rag?.provider, model: rag?.model,
        confidenceScore: rag?.confidence_score, lowConfidence: rag?.low_confidence ?? false,
        degraded: rag?.degraded ?? false, latencyMs, errored,
      });
    } catch {
      // Usage logging must never break the chat response.
    }
  }
}
