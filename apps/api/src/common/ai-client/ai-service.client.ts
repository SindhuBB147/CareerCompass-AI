import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response as ExpressResponse } from 'express';
import { DomainException } from '../filters/domain.exception';
import { HttpStatus } from '@nestjs/common';

// ── Shapes returned by apps/ai-service (schemas.py) ─────────────────────────

export interface StructuredContextItem {
  type: string;
  id: string;
  title: string;
  content: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface RagQueryPayload {
  query: string;
  session_id?: string;
  student_context: Record<string, unknown>;
  structured_context: StructuredContextItem[];
  conversation_history: ConversationTurn[];
}

export interface SourceCitation {
  tag: string;
  source_type: string;
  source_id: string;
  title: string;
  snippet: string;
}

export interface ActionButton {
  label: string;
  action: string;
  params: Record<string, string>;
}

export interface RagQueryResponse {
  answer: string;
  reasoning: string;
  intent: string;
  confidence_score: number;
  confidence_level: 'high' | 'medium' | 'low';
  low_confidence: boolean;
  sources_cited: SourceCitation[];
  suggested_questions: string[];
  related_colleges: string[];
  action_buttons: ActionButton[];
  provider: string;
  model: string;
  degraded: boolean;
}

export interface KnowledgeUploadResponse {
  document_id: string;
  title: string;
  status: string;
  chunk_count: number;
  reused_existing: boolean;
}

export interface KnowledgeStatusResponse {
  documents: Array<{
    id: string; title: string; doc_type: string; status: string; chunk_count: number;
    embedding_model: string | null; source_filename: string | null;
    created_at: string; updated_at: string;
  }>;
  total_chunks: number;
}

export interface ReindexResponse {
  reindexed_documents: number;
  reindexed_chunks: number;
}

// ── Smart Search analysis (rag/search_entities.py + rag/search_intent.py) ──

export interface SearchEntities {
  exam: string | null;
  discipline: string | null;
  college_type: string | null;
  city: string | null;
  category: string | null;
  budget_max: number | null;
  nirf_max: number | null;
  rank: number | null;
  use_profile_rank: boolean;
  hostel_required: boolean;
  placement_focus: boolean;
  scholarship_focus: boolean;
  roi_focus: boolean;
  action: string | null;
  college_names: string[];
  sort_hint: string | null;
}

export interface SearchAnalyzeResponse {
  intent: string;
  confidence: number;
  entities: SearchEntities;
  expanded_query: string;
}

/**
 * Typed HTTP client for the Python RAG engine (apps/ai-service). Nest owns
 * auth, session persistence, and structured-context gathering; ai-service
 * owns retrieval, prompting, the LLM call, and response validation. See
 * counsellor.service.ts and context-aggregator.service.ts (chat) and
 * search.service.ts (search) for the split. Lives in common/ because both
 * the AI Counsellor and Smart Search features depend on it.
 */
@Injectable()
export class AiServiceClient {
  private readonly logger = new Logger('AiServiceClient');
  private readonly baseUrl: string;
  private readonly internalToken: string | undefined;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:8000').replace(/\/$/, '');
    this.internalToken = this.config.get<string>('AI_SERVICE_INTERNAL_TOKEN') ?? undefined;
    this.timeoutMs = Number(this.config.get<string>('AI_SERVICE_TIMEOUT_MS') ?? 30000);
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.internalToken ? { 'X-Internal-Token': this.internalToken } : {}),
      ...extra,
    };
  }

  async query(payload: RagQueryPayload): Promise<RagQueryResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/rag/query`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`ai-service /rag/query ${res.status}: ${text}`);
      }
      return (await res.json()) as RagQueryResponse;
    } catch (err) {
      this.logger.error(`RAG query failed: ${(err as Error).message}`);
      throw new DomainException(
        'AI_SERVICE_UNAVAILABLE',
        'The AI Counsellor is temporarily unavailable. Please try again shortly.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Streams ai-service's SSE response straight through to the client
   * response while also buffering the raw bytes so the final `event: done`
   * payload can be parsed and returned for persistence once the stream ends.
   */
  async streamQuery(payload: RagQueryPayload, res: ExpressResponse): Promise<Record<string, unknown> | null> {
    const upstream = await fetch(`${this.baseUrl}/rag/query/stream`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });

    if (!upstream.ok || !upstream.body) {
      throw new DomainException(
        'AI_SERVICE_UNAVAILABLE',
        'The AI Counsellor is temporarily unavailable. Please try again shortly.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let buffer = '';
    let donePayload: Record<string, unknown> | null = null;

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      res.write(chunk);
    }
    res.end();

    const doneMatch = buffer.match(/event: done\ndata: (.+)\n\n/);
    if (doneMatch) {
      try {
        donePayload = JSON.parse(doneMatch[1]);
      } catch {
        donePayload = null;
      }
    }
    return donePayload;
  }

  async uploadKnowledge(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    docType: string,
    title: string | undefined,
    uploadedBy: string,
  ): Promise<KnowledgeUploadResponse> {
    const form = new FormData();
    form.append('file', new Blob([fileBuffer], { type: mimeType }), filename);

    const params = new URLSearchParams({ doc_type: docType, uploaded_by: uploadedBy });
    if (title) params.set('title', title);

    const res = await fetch(`${this.baseUrl}/knowledge/upload?${params.toString()}`, {
      method: 'POST',
      headers: this.headers(),
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new DomainException('KNOWLEDGE_UPLOAD_FAILED', `Upload failed: ${text}`, HttpStatus.BAD_GATEWAY);
    }
    return (await res.json()) as KnowledgeUploadResponse;
  }

  async reindex(documentId?: string): Promise<ReindexResponse> {
    const res = await fetch(`${this.baseUrl}/knowledge/reindex`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ document_id: documentId ?? null }),
    });
    if (!res.ok) {
      throw new DomainException('KNOWLEDGE_REINDEX_FAILED', 'Reindex failed.', HttpStatus.BAD_GATEWAY);
    }
    return (await res.json()) as ReindexResponse;
  }

  async knowledgeStatus(): Promise<KnowledgeStatusResponse> {
    const res = await fetch(`${this.baseUrl}/knowledge/status`, { headers: this.headers() });
    if (!res.ok) {
      throw new DomainException('KNOWLEDGE_STATUS_FAILED', 'Could not fetch knowledge status.', HttpStatus.BAD_GATEWAY);
    }
    return (await res.json()) as KnowledgeStatusResponse;
  }

  async deleteKnowledgeDocument(documentId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/knowledge/${documentId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new DomainException('KNOWLEDGE_DELETE_FAILED', 'Could not delete document.', HttpStatus.BAD_GATEWAY);
    }
  }

  /**
   * Pure regex/keyword intent + entity analysis for Smart Search — no LLM
   * call on the ai-service side, so this is safe to await inline in the
   * primary POST /search response path (unlike query(), which always
   * invokes an LLM and must stay off that path — see search.service.ts).
   */
  async searchAnalyze(query: string): Promise<SearchAnalyzeResponse> {
    const res = await fetch(`${this.baseUrl}/search/analyze`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new DomainException('AI_SERVICE_UNAVAILABLE', `Search analysis failed: ${text}`, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return (await res.json()) as SearchAnalyzeResponse;
  }

  async predictML(payload: {
    exam: string;
    year: number;
    round: string | number;
    college_code: string;
    course_code: string;
    category: string;
    quota?: string | null;
    college_type?: string | null;
  }): Promise<{
    success: boolean;
    exam: string;
    predictedClosingRank: number;
    model: string;
    modelVersion: string;
    confidence: any;
  }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          exam: payload.exam,
          year: payload.year,
          round: payload.round,
          college_code: payload.college_code,
          course_code: payload.course_code,
          category: payload.category,
          quota: payload.quota ?? null,
          college_type: payload.college_type ?? null,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`ai-service /predict ${res.status}: ${text}`);
      }
      return (await res.json()) as any;
    } catch (err) {
      this.logger.error(`ML prediction failed: ${(err as Error).message}`);
      throw new DomainException(
        'AI_SERVICE_UNAVAILABLE',
        'The ML prediction service is temporarily unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
