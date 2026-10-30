import type { RagQueryResponse } from './ai-service.client';

export interface NormalizedCitation {
  tag: string;
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
}

export interface NormalizedRagResponse {
  content: string;
  reasoning?: string;
  intent?: string;
  confidenceScore?: number;
  confidenceLevel?: string;
  lowConfidence: boolean;
  sourcesCited: NormalizedCitation[];
  structuredSources: Array<{ type: string; id: string; title: string }>;
  suggestedQuestions: string[];
  relatedColleges: string[];
  actionButtons: RagQueryResponse['action_buttons'];
  provider?: string;
}

/**
 * ai-service (Python) returns snake_case field names; everything Nest
 * persists and returns to the frontend is camelCase. This is the single
 * place that knows the mapping — used by both the non-streaming response
 * path (CounsellorService.toAssistantMessage) and the streaming path's
 * final `event: done` frame (AiServiceClient.streamQuery), which
 * previously reimplemented this mapping independently on the frontend.
 */
export function normalizeRagResponse(rag: RagQueryResponse & { answer?: string }): NormalizedRagResponse {
  const sourcesCited: NormalizedCitation[] = (rag.sources_cited ?? []).map(s => ({
    tag: s.tag, sourceType: s.source_type, sourceId: s.source_id, title: s.title, snippet: s.snippet,
  }));

  return {
    content: rag.answer ?? '',
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
  };
}
