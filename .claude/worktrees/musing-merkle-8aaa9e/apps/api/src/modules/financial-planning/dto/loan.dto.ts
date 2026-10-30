import {
  IsArray, IsBoolean, IsNumber, IsOptional, IsString, Min, ArrayMinSize, ArrayMaxSize, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LoanCalculatorDto {
  @IsNumber() @Min(10000) loanAmount: number;
  @IsNumber() @Min(1) interestRate: number; // e.g. 8.5%
  @IsNumber() @Min(1) tenureYears: number;  // e.g. 10 years
  @IsOptional() @IsNumber() @Min(0) moratoriumMonths?: number; // Repayment holiday during study
  @IsOptional() @IsNumber() @Min(0) processingFeePercent?: number;
  @IsOptional() @IsNumber() @Min(0) processingFeeCap?: number;
  @IsOptional() @IsBoolean() includeMonthlySchedule?: boolean;
}

export class LoanOfferInputDto {
  @IsString() label: string;
  @IsNumber() @Min(10000) loanAmount: number;
  @IsNumber() @Min(1) interestRate: number;
  @IsNumber() @Min(1) tenureYears: number;
  @IsOptional() @IsNumber() @Min(0) moratoriumMonths?: number;
  @IsOptional() @IsNumber() @Min(0) processingFeePercent?: number;
  @IsOptional() @IsNumber() @Min(0) processingFeeCap?: number;
}

export class CompareLoanOffersDto {
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(3)
  @ValidateNested({ each: true }) @Type(() => LoanOfferInputDto)
  offers: LoanOfferInputDto[];
}
