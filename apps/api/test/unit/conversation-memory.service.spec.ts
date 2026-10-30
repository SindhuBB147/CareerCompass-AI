import { ConversationMemoryService } from '../../src/modules/counsellor/services/conversation-memory.service';

function makeEntities(overrides: Record<string, unknown> = {}) {
  return {
    exam: null, discipline: null, college_type: null, city: null, category: null,
    budget_max: null, nirf_max: null, rank: null, use_profile_rank: false,
    hostel_required: false, placement_focus: false, scholarship_focus: false, roi_focus: false,
    action: null, college_names: [], sort_hint: null,
    ...overrides,
  };
}

describe('ConversationMemoryService', () => {
  let model: any;
  let aiServiceClient: any;
  let userRepo: any;
  let service: ConversationMemoryService;

  beforeEach(() => {
    model = { findOneAndUpdate: jest.fn(), findOne: jest.fn(), deleteOne: jest.fn() };
    aiServiceClient = { searchAnalyze: jest.fn() };
    userRepo = { findById: jest.fn().mockResolvedValue({ aiPersonalization: { conversationMemoryEnabled: true } }) };
    service = new ConversationMemoryService(model, aiServiceClient, userRepo);
  });

  describe('extractAndMerge', () => {
    it('merges newly-mentioned entities into persisted slots and returns the merged view', async () => {
      aiServiceClient.searchAnalyze.mockResolvedValue({
        intent: 'search_colleges', confidence: 0.9, expanded_query: 'CSE Bangalore',
        entities: makeEntities({ discipline: 'CSE', city: 'Bangalore' }),
      });
      model.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ slots: { discipline: 'CSE', city: 'Bangalore' } }),
      });

      const result = await service.extractAndMerge('u1', 'sess1', 'I want CSE in Bangalore');

      expect(aiServiceClient.searchAnalyze).toHaveBeenCalledWith('I want CSE in Bangalore');
      const [filter, update, opts] = model.findOneAndUpdate.mock.calls[0];
      expect(filter).toEqual({ userId: 'u1' });
      expect(update.$set['slots.discipline']).toBe('CSE');
      expect(update.$set['slots.city']).toBe('Bangalore');
      expect(update.$set.lastSourceSessionId).toBe('sess1');
      expect(opts).toEqual({ upsert: true, new: true });
      expect(result).toEqual(expect.objectContaining({ discipline: 'CSE', city: 'Bangalore' }));
    });

    it('does not write to Mongo when no entities were extracted, but still returns existing slots', async () => {
      aiServiceClient.searchAnalyze.mockResolvedValue({
        intent: 'general', confidence: 0.1, expanded_query: 'recommend colleges',
        entities: makeEntities(),
      });
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ slots: { discipline: 'CSE', city: 'Bangalore' } }) });

      const result = await service.extractAndMerge('u1', 'sess1', 'recommend colleges');

      expect(model.findOneAndUpdate).not.toHaveBeenCalled();
      expect(model.findOne).toHaveBeenCalledWith({ userId: 'u1' });
      expect(result).toEqual(expect.objectContaining({ discipline: 'CSE', city: 'Bangalore' }));
    });

    it('is disabled per-user via aiPersonalization.conversationMemoryEnabled', async () => {
      userRepo.findById.mockResolvedValue({ aiPersonalization: { conversationMemoryEnabled: false } });
      const result = await service.extractAndMerge('u1', 'sess1', 'I want CSE in Bangalore');
      expect(aiServiceClient.searchAnalyze).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('never throws when ai-service is unavailable — degrades to existing slots', async () => {
      aiServiceClient.searchAnalyze.mockRejectedValue(new Error('ai-service down'));
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ slots: { discipline: 'CSE' } }) });

      const result = await service.extractAndMerge('u1', 'sess1', 'anything');
      expect(result).toEqual(expect.objectContaining({ discipline: 'CSE' }));
    });
  });

  describe('getSlots', () => {
    it('returns {} when the user has no memory doc yet', async () => {
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      expect(await service.getSlots('u1')).toEqual({});
    });
  });

  describe('clearSlots', () => {
    it('deletes the memory doc for the user', async () => {
      model.deleteOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) });
      await service.clearSlots('u1');
      expect(model.deleteOne).toHaveBeenCalledWith({ userId: 'u1' });
    });
  });
});
