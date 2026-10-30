import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class BudgetPlannerDto {
  @IsNumber() @Min(0) collegeFeePerYear: number;
  @IsString() city: string; // e.g. 'Bangalore', 'Mysore', 'Mangalore'
  @IsOptional() @IsNumber() @Min(0) personalSpendingMonthly?: number;
}
