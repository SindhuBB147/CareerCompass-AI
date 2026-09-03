import { AiServiceClient } from '../../src/common/ai-client/ai-service.client';
import { DomainException } from '../../src/common/filters/domain.exception';

function configMock(values: Record<string, string>) {
  return { get: jest.fn((key: string) => values[key]) };
}

describe('AiServiceClient', () => {
  const baseValues = {
    AI_SERVICE_URL: 'http://ai-service.test',
    AI_SERVICE_INTERNAL_TOKEN: 'secret-token',
    AI_SERVICE_TIMEOUT_MS: '5000',
  };

  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends the internal token header and returns the parsed RAG response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: 'hello', intent: 'general' }),
    });
    global.fetch = mockFetch as any;

    const client = new AiServiceClient(configMock(baseValues) as any);
    const result = await client.query({
      query: 'hi', student_context: {}, structured_context: [], conversation_history: [],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://ai-service.test/rag/query',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Internal-Token': 'secret-token', 'Content-Type': 'application/json' }),
      }),
    );
    expect(result).toEqual({ answer: 'hello', intent: 'general' });
  });

  it('throws a DomainException with SERVICE_UNAVAILABLE when ai-service errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }) as any;

    const client = new AiServiceClient(configMock(baseValues) as any);
    await expect(
      client.query({ query: 'hi', student_context: {}, structured_context: [], conversation_history: [] }),
    ).rejects.toThrow(DomainException);
  });

  it('throws a DomainException when the network request itself fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;

    const client = new AiServiceClient(configMock(baseValues) as any);
    await expect(
      client.query({ query: 'hi', student_context: {}, structured_context: [], conversation_history: [] }),
    ).rejects.toThrow(DomainException);
  });

  it('falls back to localhost:8000 when AI_SERVICE_URL is not configured', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = mockFetch as any;

    const client = new AiServiceClient(configMock({}) as any);
    await client.query({ query: 'hi', student_context: {}, structured_context: [], conversation_history: [] });

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/rag/query', expect.anything());
  });

  it('knowledgeStatus() calls the correct endpoint and surfaces failures as DomainException', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 }) as any;
    const client = new AiServiceClient(configMock(baseValues) as any);
    await expect(client.knowledgeStatus()).rejects.toThrow(DomainException);
  });

  it('reindex() posts the document_id (or null for a full reindex)', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ reindexed_documents: 1, reindexed_chunks: 4 }) });
    global.fetch = mockFetch as any;

    const client = new AiServiceClient(configMock(baseValues) as any);
    const result = await client.reindex('doc-123');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://ai-service.test/knowledge/reindex',
      expect.objectContaining({ body: JSON.stringify({ document_id: 'doc-123' }) }),
    );
    expect(result.reindexed_chunks).toBe(4);
  });

  it('deleteKnowledgeDocument() throws on failure and resolves silently on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
    const client = new AiServiceClient(configMock(baseValues) as any);
    await expect(client.deleteKnowledgeDocument('doc-1')).resolves.toBeUndefined();

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as any;
    const client2 = new AiServiceClient(configMock(baseValues) as any);
    await expect(client2.deleteKnowledgeDocument('doc-1')).rejects.toThrow(DomainException);
  });

  it('searchAnalyze() posts the query and returns the parsed intent/entities', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ intent: 'search_colleges', confidence: 0.5, entities: {}, expanded_query: 'cse' }),
    });
    global.fetch = mockFetch as any;

    const client = new AiServiceClient(configMock(baseValues) as any);
    const result = await client.searchAnalyze('cse');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://ai-service.test/search/analyze',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ query: 'cse' }) }),
    );
    expect(result.intent).toBe('search_colleges');
  });

  it('searchAnalyze() throws a DomainException on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }) as any;
    const client = new AiServiceClient(configMock(baseValues) as any);
    await expect(client.searchAnalyze('cse')).rejects.toThrow(DomainException);
  });

  it('predictML() posts to /predict and returns the predicted rank', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, exam: 'KCET', predictedClosingRank: 5200, model: 'random_forest', modelVersion: 'v2.0-p1-recommendation', confidence: null }),
    });
    global.fetch = mockFetch as any;

    const client = new AiServiceClient(configMock(baseValues) as any);
    const result = await client.predictML({
      exam: 'KCET', year: 2025, round: 1, college_code: 'E001', course_code: 'CS', category: 'GM', quota: 'General', college_type: 'Government'
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://ai-service.test/predict',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          exam: 'KCET', year: 2025, round: 1, college_code: 'E001', course_code: 'CS', category: 'GM', quota: 'General', college_type: 'Government'
        }),
      }),
    );
    expect(result.predictedClosingRank).toBe(5200);
  });

  it('predictML() throws a DomainException on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }) as any;
    const client = new AiServiceClient(configMock(baseValues) as any);
    await expect(client.predictML({
      exam: 'KCET', year: 2025, round: 1, college_code: 'E001', course_code: 'CS', category: 'GM'
    })).rejects.toThrow(DomainException);
  });
});
