import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CollegeCourseIdDto {
  @IsString() collegeId: string;
  @IsString() courseId: string;
}

export class FinancialComparisonRequestDto {
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(4)
  @ValidateNested({ each: true }) @Type(() => CollegeCourseIdDto)
  collegeCourseIds: CollegeCourseIdDto[];

  @IsBoolean() hostelRequired: boolean;
}
