import {
  IsIn, IsInt, IsOptional, IsString, Min, MaxLength, MinLength,
} from 'class-validator';

export class StartSessionDto {
  @IsOptional() @IsString() @MaxLength(2000) initialMessage?: string;
}

export class SendMessageDto {
  @IsString() @MinLength(1) @MaxLength(2000) content: string;
}

export class FeedbackDto {
  @IsString() sessionId: string;
  @IsInt() @Min(0) messageIndex: number;
  @IsIn(['up', 'down']) rating: 'up' | 'down';
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

export class KnowledgeUploadQueryDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  // Not an @IsIn() enum — valid values come from the knowledge_categories
  // DB table (ai-service GET /knowledge/categories), not a hardcoded list
  // here. An unknown code is still rejected — ai-service's doc_type ->
  // knowledge_categories FK constraint catches it (main.py's
  // ForeignKeyViolationError handling).
  @IsOptional() @IsString() @MaxLength(100) docType?: string;
}

export class ReindexDto {
  @IsOptional() @IsString() documentId?: string;
}

export class CreatePromptTemplateDto {
  @IsString() @MinLength(1) @MaxLength(200) name: string;
  @IsString() @MinLength(1) @MaxLength(20000) systemPrompt: string;
}

export class UpdatePromptTemplateDto {
  @IsString() @MinLength(1) @MaxLength(20000) systemPrompt: string;
}

export class SetLlmProviderDto {
  @IsIn(['azure_openai', 'openai', 'gemini', 'ollama', 'fallback'])
  provider: string;
}
