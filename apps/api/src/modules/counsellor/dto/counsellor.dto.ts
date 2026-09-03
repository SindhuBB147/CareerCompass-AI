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
  @IsOptional()
  @IsIn(['brochure', 'admission_rules', 'scholarship_pdf', 'circular', 'placement_report', 'faq', 'general'])
  docType?: string;
}

export class ReindexDto {
  @IsOptional() @IsString() documentId?: string;
}
