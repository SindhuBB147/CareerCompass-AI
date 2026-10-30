import { AdminCounsellorController } from '../../src/modules/counsellor/controllers/admin-counsellor.controller';

describe('AdminCounsellorController', () => {
  let svc: any;
  let aiServiceClient: any;
  let auditModel: any;
  let controller: AdminCounsellorController;

  const reqAs = (adminId: string) => ({ user: { sub: adminId }, ip: '127.0.0.1' } as any);

  beforeEach(() => {
    svc = { listFlaggedSessions: jest.fn(), getUsageSummary: jest.fn() };
    aiServiceClient = {
      uploadKnowledge: jest.fn(),
      reindex: jest.fn(),
      knowledgeStatus: jest.fn(),
      knowledgeCategories: jest.fn(),
      knowledgeChunks: jest.fn(),
      deleteKnowledgeDocument: jest.fn(),
      listPromptTemplates: jest.fn(),
      createPromptTemplate: jest.fn(),
      updatePromptTemplate: jest.fn(),
      activatePromptTemplate: jest.fn(),
      deletePromptTemplate: jest.fn(),
      getLlmProviderSettings: jest.fn(),
      setLlmProviderOverride: jest.fn(),
    };
    auditModel = { create: jest.fn() };
    controller = new AdminCounsellorController(svc, aiServiceClient, auditModel);
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

  describe('knowledge categories and chunks', () => {
    it('proxies the categories list', async () => {
      aiServiceClient.knowledgeCategories.mockResolvedValue({ categories: [{ code: 'faq', label: 'FAQ' }] });
      const result = await controller.knowledgeCategories();
      expect(result).toEqual({ success: true, data: { categories: [{ code: 'faq', label: 'FAQ' }] } });
    });

    it('proxies a document\'s chunks', async () => {
      aiServiceClient.knowledgeChunks.mockResolvedValue({ document_id: 'doc-1', chunks: [] });
      const result = await controller.knowledgeChunks('doc-1');
      expect(aiServiceClient.knowledgeChunks).toHaveBeenCalledWith('doc-1');
      expect(result).toEqual({ success: true, data: { document_id: 'doc-1', chunks: [] } });
    });
  });

  describe('knowledge mutations record an audit entry', () => {
    it('records an audit entry on upload', async () => {
      aiServiceClient.uploadKnowledge.mockResolvedValue({
        document_id: 'doc-1', title: 'Brochure', status: 'indexed', chunk_count: 3, reused_existing: false,
      });
      const file = { mimetype: 'application/pdf', size: 1024, buffer: Buffer.from('x'), originalname: 'b.pdf' } as any;

      await controller.uploadKnowledge(file, { docType: 'brochure' } as any, reqAs('admin-1'));

      expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({
        adminId: 'admin-1', action: 'knowledge.upload', targetCollection: 'knowledge_documents', targetId: 'doc-1',
      }));
    });

    it('records an audit entry on reindex', async () => {
      aiServiceClient.reindex.mockResolvedValue({ reindexed_documents: 1, reindexed_chunks: 4 });

      await controller.reindex({ documentId: 'doc-1' } as any, reqAs('admin-1'));

      expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({
        adminId: 'admin-1', action: 'knowledge.reindex', targetId: 'doc-1',
      }));
    });

    it('records an audit entry on delete', async () => {
      aiServiceClient.deleteKnowledgeDocument.mockResolvedValue(undefined);

      await controller.deleteKnowledge('doc-1', reqAs('admin-1'));

      expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({
        adminId: 'admin-1', action: 'knowledge.delete', targetId: 'doc-1',
      }));
    });
  });

  describe('upload MIME allowlist', () => {
    it('accepts a CSV upload', async () => {
      aiServiceClient.uploadKnowledge.mockResolvedValue({
        document_id: 'doc-2', title: 'Seats', status: 'indexed', chunk_count: 2, reused_existing: false,
      });
      const file = { mimetype: 'text/csv', size: 512, buffer: Buffer.from('x'), originalname: 'seats.csv' } as any;

      const result = await controller.uploadKnowledge(file, {} as any, reqAs('admin-1'));

      expect(result).toEqual({ success: true, data: expect.objectContaining({ document_id: 'doc-2' }) });
    });

    it('accepts a JSON upload', async () => {
      aiServiceClient.uploadKnowledge.mockResolvedValue({
        document_id: 'doc-3', title: 'Seats', status: 'indexed', chunk_count: 2, reused_existing: false,
      });
      const file = { mimetype: 'application/json', size: 512, buffer: Buffer.from('x'), originalname: 'seats.json' } as any;

      const result = await controller.uploadKnowledge(file, {} as any, reqAs('admin-1'));

      expect(result).toEqual({ success: true, data: expect.objectContaining({ document_id: 'doc-3' }) });
    });

    it('rejects an unsupported MIME type', async () => {
      const file = { mimetype: 'application/x-msdownload', size: 512, buffer: Buffer.from('x'), originalname: 'evil.exe' } as any;

      await expect(controller.uploadKnowledge(file, {} as any, reqAs('admin-1'))).rejects.toThrow();
      expect(aiServiceClient.uploadKnowledge).not.toHaveBeenCalled();
    });
  });
});
