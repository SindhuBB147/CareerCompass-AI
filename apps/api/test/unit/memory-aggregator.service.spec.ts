import { MemoryAggregatorService } from '../../src/modules/memory/services/memory-aggregator.service';

function makeDeps() {
  return {
    userRepo: { findById: jest.fn().mockResolvedValue({ fullName: 'Asha', preferences: {}, aiPersonalization: {}, academic: {} }), updateProfile: jest.fn().mockResolvedValue({}) },
    wishlistService: { getWishlist: jest.fn().mockResolvedValue({ lists: [], colleges: [] }) },
    recentlyViewedService: { list: jest.fn().mockResolvedValue([]), clear: jest.fn().mockResolvedValue(undefined) },
    searchHistoryService: { listRecent: jest.fn().mockResolvedValue([]), listSaved: jest.fn().mockResolvedValue([]), clearAll: jest.fn().mockResolvedValue(undefined) },
    conversationMemoryService: { getSlots: jest.fn().mockResolvedValue({}), clearSlots: jest.fn().mockResolvedValue(undefined) },
    counsellorService: { listSessions: jest.fn().mockResolvedValue([]), deleteAllSessions: jest.fn().mockResolvedValue(undefined) },
    predictionService: { getShortlistPredictions: jest.fn().mockResolvedValue([]) },
    financialPlanScenarioService: { listHistory: jest.fn().mockResolvedValue([]), clear: jest.fn().mockResolvedValue(undefined) },
    scholarshipService: { listBookmarks: jest.fn().mockResolvedValue([]) },
    scholarshipInteractionService: { listForUser: jest.fn().mockResolvedValue([]), clear: jest.fn().mockResolvedValue(undefined) },
    roadmapGeneratorService: { getOrGenerate: jest.fn().mockResolvedValue(null) },
    notificationService: { listForUser: jest.fn().mockResolvedValue({ notifications: [], total: 0 }) },
    consentService: { getConsent: jest.fn().mockResolvedValue({ necessary: true, functional: false, analytics: false, preference: false, aiPersonalization: false, policyVersion: '1.0' }) },
    sessionStateService: { getState: jest.fn().mockResolvedValue(null), clear: jest.fn().mockResolvedValue(undefined) },
  };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new MemoryAggregatorService(
    deps.userRepo as any, deps.wishlistService as any, deps.recentlyViewedService as any,
    deps.searchHistoryService as any, deps.conversationMemoryService as any, deps.counsellorService as any,
    deps.predictionService as any, deps.financialPlanScenarioService as any, deps.scholarshipService as any,
    deps.scholarshipInteractionService as any, deps.roadmapGeneratorService as any, deps.notificationService as any,
    deps.consentService as any, deps.sessionStateService as any,
  );
}

describe('MemoryAggregatorService', () => {
  describe('getSummary', () => {
    it('aggregates every category into one payload', async () => {
      const deps = makeDeps();
      const service = makeService(deps);
      const summary = await service.getSummary('u1');

      expect(summary.profile).toEqual(expect.objectContaining({ fullName: 'Asha' }));
      expect(summary).toHaveProperty('aiConversationMemory');
      expect(summary).toHaveProperty('searchMemory');
      expect(summary).toHaveProperty('recommendationMemory');
      expect(summary).toHaveProperty('consent');
      expect(summary).toHaveProperty('sessionState');
    });

    it('degrades a single failing category to a fallback instead of failing the whole summary', async () => {
      const deps = makeDeps();
      deps.wishlistService.getWishlist.mockRejectedValue(new Error('wishlist down'));
      const service = makeService(deps);

      const summary = await service.getSummary('u1');
      expect((summary.recommendationMemory as any).saved).toEqual({ lists: [], colleges: [] });
    });
  });

  describe('deleteCategory', () => {
    it.each([
      ['searchHistory', 'searchHistoryService', 'clearAll'],
      ['conversationHistory', 'counsellorService', 'deleteAllSessions'],
      ['aiMemorySlots', 'conversationMemoryService', 'clearSlots'],
      ['recentlyViewedColleges', 'recentlyViewedService', 'clear'],
      ['financialPlanHistory', 'financialPlanScenarioService', 'clear'],
      ['scholarshipInteractions', 'scholarshipInteractionService', 'clear'],
      ['sessionState', 'sessionStateService', 'clear'],
    ])('routes "%s" to %s.%s', async (category, depKey, method) => {
      const deps = makeDeps();
      const service = makeService(deps);
      await service.deleteCategory('u1', category);
      expect((deps as any)[depKey][method]).toHaveBeenCalledWith('u1');
    });

    it('rejects an unknown category', async () => {
      const service = makeService(makeDeps());
      await expect(service.deleteCategory('u1', 'somethingElse')).rejects.toThrow();
    });
  });

  describe('resetPersonalization', () => {
    it('clears AI memory slots and session state, and resets toggles to defaults', async () => {
      const deps = makeDeps();
      const service = makeService(deps);
      await service.resetPersonalization('u1');

      expect(deps.conversationMemoryService.clearSlots).toHaveBeenCalledWith('u1');
      expect(deps.sessionStateService.clear).toHaveBeenCalledWith('u1');
      expect(deps.userRepo.updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({
        'aiPersonalization.receiveAiSuggestions': true,
        'aiPersonalization.conversationMemoryEnabled': true,
        'aiPersonalization.searchHistoryEnabled': true,
      }));
    });
  });

  describe('updatePersonalizationSettings', () => {
    it('only sets the fields provided', async () => {
      const deps = makeDeps();
      const service = makeService(deps);
      await service.updatePersonalizationSettings('u1', { conversationMemoryEnabled: false });

      expect(deps.userRepo.updateProfile).toHaveBeenCalledWith('u1', { 'aiPersonalization.conversationMemoryEnabled': false });
    });

    it('does nothing when no fields are provided', async () => {
      const deps = makeDeps();
      const service = makeService(deps);
      await service.updatePersonalizationSettings('u1', {});
      expect(deps.userRepo.updateProfile).not.toHaveBeenCalled();
    });
  });
});
