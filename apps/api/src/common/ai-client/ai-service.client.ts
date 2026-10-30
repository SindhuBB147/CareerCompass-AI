import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response as ExpressResponse } from 'express';
import { DomainException } from '../filters/domain.exception';
import { HttpStatus } from '@nestjs/common';
import { normalizeRagResponse } from './normalize-rag-response';

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
  page_number?: number | null;
  page_range?: string | null;
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
  tokens_in: number;
  tokens_out: number;
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

export interface KnowledgeCategory {
  code: string;
  label: string;
  description: string | null;
}

export interface KnowledgeCategoriesResponse {
  categories: KnowledgeCategory[];
}

export interface ChunkSummary {
  chunk_id: string;
  chunk_index: number;
  snippet: string;
  page_number: number | null;
  page_range: string | null;
}

export interface DocumentChunksResponse {
  document_id: string;
  chunks: ChunkSummary[];
}

// ── Prompt template admin (rag/prompt_template_store.py) ────────────────────

export interface PromptTemplateRecord {
  id: string;
  name: string;
  version: number;
  system_prompt: string;
  is_active: boolean;
  created_at: string;
}

export interface PromptTemplateListResponse {
  templates: PromptTemplateRecord[];
}

// ── LLM provider admin (rag/llm/provider_resolver.py) ───────────────────────

export interface LlmProviderSettingsResponse {
  configured_providers: string[];
  active_override: string | null;
  effective_provider: string;
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
   * Streams ai-service's SSE response through to the client, frame by
   * frame, so the terminal `event: done` frame can be intercepted and
   * rewritten from ai-service's snake_case into the same camelCase shape
   * the non-streaming path returns (via the shared normalizeRagResponse) —
   * the frontend then has exactly one response shape to handle instead of
   * two. Every `data: {delta}` frame is still forwarded byte-for-byte as
   * soon as it's fully received, so this doesn't add streaming latency —
   * only the already-complete final frame is rewritten before being sent.
   * Returns the raw (snake_case) done payload for the caller's own
   * persistence/logging use, unchanged from before.
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
      buffer += decoder.decode(value, { stream: true });

      let frameEnd = buffer.indexOf('\n\n');
      while (frameEnd !== -1) {
        const frame = buffer.slice(0, frameEnd);
        buffer = buffer.slice(frameEnd + 2);

        if (frame.startsWith('event: done')) {
          const dataLine = frame.split('\n').find(l => l.startsWith('data:'));
          if (dataLine) {
            try {
              donePayload = JSON.parse(dataLine.slice('data:'.length).trim());
              res.write(`event: done\ndata: ${JSON.stringify(normalizeRagResponse(donePayload as any))}\n\n`);
            } catch {
              res.write(`${frame}\n\n`); // malformed payload — fall back to raw passthrough
            }
          } else {
            res.write(`${frame}\n\n`);
          }
        } else {
          res.write(`${frame}\n\n`);
        }

        frameEnd = buffer.indexOf('\n\n');
      }
    }
    if (buffer.trim()) res.write(buffer); // best-effort flush of any unterminated trailing bytes
    res.end();

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

    // Deliberately not this.headers() — that forces Content-Type:
    // application/json, which stops fetch from setting the multipart
    // boundary header a FormData body needs, and ai-service then sees no
    // "file" field at all.
    const res = await fetch(`${this.baseUrl}/knowledge/upload?${params.toString()}`, {
      method: 'POST',
      headers: this.internalToken ? { 'X-Internal-Token': this.internalToken } : undefined,
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

  async knowledgeCategories(): Promise<KnowledgeCategoriesResponse> {
    const res = await fetch(`${this.baseUrl}/knowledge/categories`, { headers: this.headers() });
    if (!res.ok) {
      throw new DomainException('KNOWLEDGE_CATEGORIES_FAILED', 'Could not fetch knowledge categories.', HttpStatus.BAD_GATEWAY);
    }
    return (await res.json()) as KnowledgeCategoriesResponse;
  }

  async knowledgeChunks(documentId: string): Promise<DocumentChunksResponse> {
    const res = await fetch(`${this.baseUrl}/knowledge/${documentId}/chunks`, { headers: this.headers() });
    if (res.status === 404) {
      throw new DomainException('KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Document not found.', HttpStatus.NOT_FOUND);
    }
    if (!res.ok) {
      throw new DomainException('KNOWLEDGE_CHUNKS_FAILED', 'Could not fetch document chunks.', HttpStatus.BAD_GATEWAY);
    }
    return (await res.json()) as DocumentChunksResponse;
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

  // ── Prompt template admin ──────────────────────────────────────────────────

  async listPromptTemplates(): Promise<PromptTemplateListResponse> {
    const res = await fetch(`${this.baseUrl}/prompt-templates`, { headers: this.headers() });
    if (!res.ok) {
      throw new DomainException('PROMPT_TEMPLATES_FAILED', 'Could not fetch prompt templates.', HttpStatus.BAD_GATEWAY);
    }
    return (await res.json()) as PromptTemplateListResponse;
  }

  async createPromptTemplate(name: string, systemPrompt: string): Promise<PromptTemplateRecord> {
    const res = await fetch(`${this.baseUrl}/prompt-templates`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ name, system_prompt: systemPrompt }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new DomainException('PROMPT_TEMPLATE_CREATE_FAILED', `Could not create template: ${text}`, HttpStatus.BAD_GATEWAY);
    }
    return (await res.json()) as PromptTemplateRecord;
  }

  async updatePromptTemplate(templateId: string, systemPrompt: string): Promise<PromptTemplateRecord> {
    const res = await fetch(`${this.baseUrl}/prompt-templates/${templateId}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ system_prompt: systemPrompt }),
    });
    if (!res.ok) {
      throw new DomainException('PROMPT_TEMPLATE_UPDATE_FAILED', 'Could not update template.', HttpStatus.BAD_GATEWAY);
    }
    return (await res.json()) as PromptTemplateRecord;
  }

  async activatePromptTemplate(templateId: string): Promise<PromptTemplateRecord> {
    const res = await fetch(`${this.baseUrl}/prompt-templates/${templateId}/activate`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new DomainException('PROMPT_TEMPLATE_ACTIVATE_FAILED', 'Could not activate template.', HttpStatus.BAD_GATEWAY);
    }
    return (await res.json()) as PromptTemplateRecord;
  }

  async deletePromptTemplate(templateId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/prompt-templates/${templateId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new DomainException('PROMPT_TEMPLATE_DELETE_FAILED', `Could not delete template: ${text}`, HttpStatus.BAD_GATEWAY);
    }
  }

  // ── LLM provider admin (live switch) ────────────────────────────────────────

  async getLlmProviderSettings(): Promise<LlmProviderSettingsResponse> {
    const res = await fetch(`${this.baseUrl}/settings/llm-provider`, { headers: this.headers() });
    if (!res.ok) {
      throw new DomainException('LLM_PROVIDER_SETTINGS_FAILED', 'Could not fetch LLM provider settings.', HttpStatus.BAD_GATEWAY);
    }
    return (await res.json()) as LlmProviderSettingsResponse;
  }

  async setLlmProviderOverride(provider: string): Promise<LlmProviderSettingsResponse> {
    const res = await fetch(`${this.baseUrl}/settings/llm-provider`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new DomainException('LLM_PROVIDER_SWITCH_FAILED', `Could not switch provider: ${text}`, HttpStatus.BAD_GATEWAY);
    }
    return (await res.json()) as LlmProviderSettingsResponse;
  }
}
