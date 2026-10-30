import { CounsellorService } from '../../src/modules/counsellor/services/counsellor.service';
import { DomainException } from '../../src/common/filters/domain.exception';

/** Mimics a Mongoose query builder: every method except `.exec()` returns
 * itself; `.exec()` resolves to the given value. Matches how CounsellorService
 * chains `.findOne().exec()`, `.find().select().sort().exec()`, etc.
 */
function chainable(resolvedValue: unknown) {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'exec') return () => Promise.resolve(resolvedValue);
      if (prop === 'then' || prop === 'catch') return undefined;
      return () => proxy;
    },
  };
  const proxy = new Proxy({}, handler);
  return proxy;
}

function makeConversationDoc(overrides: Record<string, any> = {}) {
  return {
    userId: 'user-1',
    sessionId: 'sess-1',
    title: undefined,
    messages: [],
    status: 'active',
    flaggedForReview: false,
    lastMessageAt: undefined,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('CounsellorService', () => {
  let convModel: any;
  let usageModel: any;
  let feedbackModel: any;
  let contextAggregator: any;
  let conversationMemory: any;
  let aiServiceClient: any;
  let service: CounsellorService;

  beforeEach(() => {
    convModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
    };
    usageModel = { create: jest.fn().mockResolvedValue(true), aggregate: jest.fn() };
    feedbackModel = { findOneAndUpdate: jest.fn() };
    contextAggregator = { gather: jest.fn() };
    conversationMemory = { extractAndMerge: jest.fn().mockResolvedValue({}) };
    aiServiceClient = { query: jest.fn(), streamQuery: jest.fn() };

    service = new CounsellorService(
      convModel, usageModel, feedbackModel, contextAggregator, conversationMemory, aiServiceClient,
    );
  });

  describe('sendMessage', () => {
    const ragResponse = {
      answer: 'RVCE CSE closing rank was 4950.',
      reasoning: 'Classified as admissions.',
      intent: 'admissions',
      confidence_score: 0.8,
      confidence_level: 'high',
      low_confidence: false,
      sources_cited: [{ tag: 'S1', source_type: 'document', source_id: 'd1', title: 'FAQ', snippet: '...' }],
      suggested_questions: ['Which colleges are safest for my rank?'],
      related_colleges: ['RVCE'],
      action_buttons: [{ label: 'Compare Colleges', action: 'compare_colleges', params: {} }],
      provider: 'openai',
      model: 'gpt-4o-mini',
      degraded: false,
    };

    it('gathers context, calls ai-service, and persists the assistant message', async () => {
      const conv = makeConversationDoc();
      convModel.findOne.mockReturnValue(chainable(conv));
      contextAggregator.gather.mockResolvedValue({
        studentContext: { rank: 4500 },
        structuredContext: [{ type: 'college', id: 'c1', title: 'RVCE', content: 'summary' }],
      });
      aiServiceClient.query.mockResolvedValue(ragResponse);

      const result = await service.sendMessage('user-1', 'sess-1', 'What is my chance at RVCE?');

      expect(conversationMemory.extractAndMerge).toHaveBeenCalledWith('user-1', 'sess-1', 'What is my chance at RVCE?');
      expect(contextAggregator.gather).toHaveBeenCalledWith('user-1', 'What is my chance at RVCE?', {});
      expect(aiServiceClient.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'What is my chance at RVCE?',
          session_id: 'sess-1',
          student_context: { rank: 4500 },
          structured_context: [{ type: 'college', id: 'c1', title: 'RVCE', content: 'summary' }],
        }),
      );
      expect(result.content).toBe(ragResponse.answer);
      expect(result.confidenceLevel).toBe('high');
      expect(result.actionButtons).toEqual(ragResponse.action_buttons);
      expect(conv.save).toHaveBeenCalled();
      expect(usageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', sessionId: 'sess-1', intent: 'admissions', errored: false }),
      );
    });

    it('flags the conversation for review when the response is low-confidence', async () => {
      const conv = makeConversationDoc();
      convModel.findOne.mockReturnValue(chainable(conv));
      contextAggregator.gather.mockResolvedValue({ studentContext: {}, structuredContext: [] });
      aiServiceClient.query.mockResolvedValue({ ...ragResponse, low_confidence: true, confidence_level: 'low' });

      await service.sendMessage('user-1', 'sess-1', 'random question');

      expect(conv.flaggedForReview).toBe(true);
    });

    it('throws NOT_FOUND when there is no active session for this user', async () => {
      convModel.findOne.mockReturnValue(chainable(null));

      await expect(service.sendMessage('user-1', 'missing-session', 'hi')).rejects.toThrow(DomainException);
    });

    it('logs a usage record and rethrows when ai-service fails', async () => {
      const conv = makeConversationDoc();
      convModel.findOne.mockReturnValue(chainable(conv));
      contextAggregator.gather.mockResolvedValue({ studentContext: {}, structuredContext: [] });
      aiServiceClient.query.mockRejectedValue(new DomainException('AI_SERVICE_UNAVAILABLE', 'down', 503 as any));

      await expect(service.sendMessage('user-1', 'sess-1', 'hi')).rejects.toThrow('down');
      expect(usageModel.create).toHaveBeenCalledWith(expect.objectContaining({ errored: true }));
    });

    it('persists token counts and an estimated cost derived from the provider/model rate table', async () => {
      const conv = makeConversationDoc();
      convModel.findOne.mockReturnValue(chainable(conv));
      contextAggregator.gather.mockResolvedValue({ studentContext: {}, structuredContext: [] });
      aiServiceClient.query.mockResolvedValue({ ...ragResponse, tokens_in: 100, tokens_out: 50 });

      await service.sendMessage('user-1', 'sess-1', 'What is my chance at RVCE?');

      expect(usageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokensIn: 100,
          tokensOut: 50,
          estimatedCostUsd: expect.closeTo(0.000045, 9),
        }),
      );
    });

    it('logs zero tokens when ai-service omits usage fields', async () => {
      const conv = makeConversationDoc();
      convModel.findOne.mockReturnValue(chainable(conv));
      contextAggregator.gather.mockResolvedValue({ studentContext: {}, structuredContext: [] });
      const { tokens_in, tokens_out, ...withoutUsage } = ragResponse as any;
      aiServiceClient.query.mockResolvedValue(withoutUsage);

      await service.sendMessage('user-1', 'sess-1', 'hi');

      expect(usageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ tokensIn: 0, tokensOut: 0 }),
      );
    });
  });

  describe('getUsageSummary', () => {
    it('aggregates token totals and derives average cost per request', async () => {
      usageModel.aggregate
        .mockReturnValueOnce(chainable([{
          totalRequests: 4, avgConfidence: 0.75, avgLatencyMs: 900,
          lowConfidenceCount: 1, erroredCount: 0,
          totalTokensIn: 400, totalTokensOut: 200, totalCostUsd: 0.02,
        }]))
        .mockReturnValueOnce(chainable([{ _id: 'admissions', count: 4 }]));

      const summary = await service.getUsageSummary();

      expect(summary).toEqual(expect.objectContaining({
        totalRequests: 4,
        totalTokensIn: 400,
        totalTokensOut: 200,
        totalCostUsd: 0.02,
        avgCostPerRequest: 0.005,
      }));
    });

    it('returns zeroed totals when there is no usage history yet', async () => {
      usageModel.aggregate.mockReturnValueOnce(chainable([])).mockReturnValueOnce(chainable([]));

      const summary = await service.getUsageSummary();

      expect(summary).toEqual(expect.objectContaining({
        totalRequests: 0, totalTokensIn: 0, totalTokensOut: 0, totalCostUsd: 0, avgCostPerRequest: 0,
      }));
    });
  });

  describe('submitFeedback', () => {
    it('rejects feedback on a non-assistant message', async () => {
      const conv = makeConversationDoc({ messages: [{ role: 'user', content: 'hi' }] });
      convModel.findOne.mockReturnValue(chainable(conv));

      await expect(
        service.submitFeedback('user-1', { sessionId: 'sess-1', messageIndex: 0, rating: 'up' }),
      ).rejects.toThrow(DomainException);
    });

    it('upserts feedback for a valid assistant message', async () => {
      const conv = makeConversationDoc({ messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'answer' }] });
      convModel.findOne.mockReturnValue(chainable(conv));
      feedbackModel.findOneAndUpdate.mockReturnValue(chainable(true));

      await service.submitFeedback('user-1', { sessionId: 'sess-1', messageIndex: 1, rating: 'down', comment: 'not helpful' });

      expect(feedbackModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-1', sessionId: 'sess-1', messageIndex: 1 },
        { rating: 'down', comment: 'not helpful' },
        { upsert: true },
      );
    });

    it('throws NOT_FOUND when the session does not belong to the user', async () => {
      convModel.findOne.mockReturnValue(chainable(null));
      await expect(
        service.submitFeedback('user-1', { sessionId: 'not-mine', messageIndex: 0, rating: 'up' }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('deleteSession', () => {
    it('throws NOT_FOUND when nothing was deleted', async () => {
      convModel.deleteOne.mockReturnValue(chainable({ deletedCount: 0 }));
      await expect(service.deleteSession('user-1', 'sess-1')).rejects.toThrow(DomainException);
    });

    it('resolves silently when the session was deleted', async () => {
      convModel.deleteOne.mockReturnValue(chainable({ deletedCount: 1 }));
      await expect(service.deleteSession('user-1', 'sess-1')).resolves.toBeUndefined();
    });
  });

  describe('deleteAllSessions', () => {
    it('deletes every conversation for the user (Memory & Privacy "Delete Conversation History")', async () => {
      convModel.deleteMany.mockReturnValue(chainable({ deletedCount: 3 }));
      await service.deleteAllSessions('user-1');
      expect(convModel.deleteMany).toHaveBeenCalledWith({ userId: 'user-1' });
    });
  });
});
