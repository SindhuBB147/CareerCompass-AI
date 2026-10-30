import { IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { REPORT_FORMATS, REPORT_TYPES } from '../models/report.model';

export class GenerateReportDto {
  @IsIn(REPORT_TYPES) reportType: string;
  @IsIn(REPORT_FORMATS) format: string;
  @IsOptional() @IsObject() params?: Record<string, unknown>;
}

export class ReportListQueryDto {
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) limit?: number;
}

export class EmailReportDto {
  @IsOptional() @IsString() to?: string;
}
