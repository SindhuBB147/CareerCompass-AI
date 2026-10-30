import { AdminCounsellorController } from '../../src/modules/counsellor/controllers/admin-counsellor.controller';

describe('AdminCounsellorController', () => {
  let svc: any;
  let aiServiceClient: any;
  let controller: AdminCounsellorController;

  beforeEach(() => {
    svc = { listFlaggedSessions: jest.fn(), getUsageSummary: jest.fn() };
    aiServiceClient = {
      uploadKnowledge: jest.fn(),
      reindex: jest.fn(),
      knowledgeStatus: jest.fn(),
      deleteKnowledgeDocument: jest.fn(),
      listPromptTemplates: jest.fn(),
      createPromptTemplate: jest.fn(),
      updatePromptTemplate: jest.fn(),
      activatePromptTemplate: jest.fn(),
      deletePromptTemplate: jest.fn(),
      getLlmProviderSettings: jest.fn(),
      setLlmProviderOverride: jest.fn(),
    };
    controller = new AdminCounsellorController(svc, aiServiceClient);
  });

  describe('prompt templates', () => {
    it('lists templates via the ai-service client', async () => {
      aiServiceClient.listPromptTemplates.mockResolvedValue({ templates: [{ id: 't1', name: 'default' }] });

      const result = await controller.listPromptTemplates();

      expect(result).toEqual({ success: true, data: { templates: [{ id: 't1', name: 'default' }] } });
    });

    it('creates a template, forwarding name and systemPrompt', async () => {
      aiServiceClient.createPromptTemplate.mockResolvedValue({ id: 't1', name: 'default', version: 1 });

      const result = await controller.createPromptTemplate({ name: 'default', systemPrompt: 'You are CareerCompass AI.' } as any);

      expect(aiServiceClient.createPromptTemplate).toHaveBeenCalledWith('default', 'You are CareerCompass AI.');
      expect(result).toEqual({ success: true, data: { id: 't1', name: 'default', version: 1 } });
    });

    it('updates a template by id', async () => {
      aiServiceClient.updatePromptTemplate.mockResolvedValue({ id: 't1', version: 2 });

      const result = await controller.updatePromptTemplate('t1', { systemPrompt: 'Updated text' } as any);

      expect(aiServiceClient.updatePromptTemplate).toHaveBeenCalledWith('t1', 'Updated text');
      expect(result).toEqual({ success: true, data: { id: 't1', version: 2 } });
    });

    it('activates a template by id', async () => {
      aiServiceClient.activatePromptTemplate.mockResolvedValue({ id: 't1', isActive: true });

      const result = await controller.activatePromptTemplate('t1');

      expect(aiServiceClient.activatePromptTemplate).toHaveBeenCalledWith('t1');
      expect(result).toEqual({ success: true, data: { id: 't1', isActive: true } });
    });

    it('deletes a template and returns a confirmation envelope', async () => {
      aiServiceClient.deletePromptTemplate.mockResolvedValue(undefined);

      const result = await controller.deletePromptTemplate('t1');

      expect(aiServiceClient.deletePromptTemplate).toHaveBeenCalledWith('t1');
      expect(result).toEqual({ success: true, data: { templateId: 't1', deleted: true } });
    });
  });

  describe('LLM provider switch', () => {
    it('reads the current provider settings', async () => {
      aiServiceClient.getLlmProviderSettings.mockResolvedValue({
        configured_providers: ['gemini', 'fallback'], active_override: null, effective_provider: 'gemini',
      });

      const result = await controller.getLlmProvider();

      expect(result.data.effective_provider).toBe('gemini');
    });

    it('forwards the requested provider to setLlmProviderOverride', async () => {
      aiServiceClient.setLlmProviderOverride.mockResolvedValue({
        configured_providers: ['gemini', 'fallback'], active_override: 'fallback', effective_provider: 'fallback',
      });

      const result = await controller.setLlmProvider({ provider: 'fallback' } as any);

      expect(aiServiceClient.setLlmProviderOverride).toHaveBeenCalledWith('fallback');
      expect(result.data.active_override).toBe('fallback');
    });
  });

  describe('existing knowledge/flagged/usage routes are unaffected', () => {
    it('still proxies knowledge status', async () => {
      aiServiceClient.knowledgeStatus.mockResolvedValue({ documents: [], total_chunks: 0 });
      const result = await controller.knowledgeStatus();
      expect(result).toEqual({ success: true, data: { documents: [], total_chunks: 0 } });
    });

    it('still proxies the usage summary', async () => {
      svc.getUsageSummary.mockResolvedValue({ totalRequests: 5 });
      const result = await controller.usage();
      expect(result).toEqual({ success: true, data: { totalRequests: 5 } });
    });
  });
});
