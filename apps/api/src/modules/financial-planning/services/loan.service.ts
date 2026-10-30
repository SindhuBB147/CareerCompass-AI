import { Injectable } from '@nestjs/common';
import { LoanCalculatorDto, CompareLoanOffersDto } from '../dto/loan.dto';
import { amortize, AmortizationResult } from '../utils/loan-amortization.util';

export interface LoanOfferComparisonResult {
  label: string;
  monthlyEmi: number;
  totalInterest: number;
  totalPayment: number;
  processingFeeAmount: number;
  totalCostOfLoan: number;
}

export interface LoanOfferComparison {
  offers: LoanOfferComparisonResult[];
  cheapestLabel: string;
}

@Injectable()
export class LoanService {
  calculateLoan(dto: LoanCalculatorDto): AmortizationResult {
    return amortize({
      loanAmount: dto.loanAmount,
      interestRate: dto.interestRate,
      tenureYears: dto.tenureYears,
      moratoriumMonths: dto.moratoriumMonths,
      processingFeePercent: dto.processingFeePercent,
      processingFeeCap: dto.processingFeeCap,
      includeMonthlySchedule: dto.includeMonthlySchedule,
    });
  }

  compareLoanOffers(dto: CompareLoanOffersDto): LoanOfferComparison {
    const offers: LoanOfferComparisonResult[] = dto.offers
      .map(offer => {
        const result = amortize({
          loanAmount: offer.loanAmount,
          interestRate: offer.interestRate,
          tenureYears: offer.tenureYears,
          moratoriumMonths: offer.moratoriumMonths,
          processingFeePercent: offer.processingFeePercent,
          processingFeeCap: offer.processingFeeCap,
        });
        return {
          label: offer.label,
          monthlyEmi: result.monthlyEmi,
          totalInterest: result.totalInterest,
          totalPayment: result.totalPayment,
          processingFeeAmount: result.processingFeeAmount,
          totalCostOfLoan: result.totalCostOfLoan,
        };
      })
      .sort((a, b) => a.totalCostOfLoan - b.totalCostOfLoan);

    return { offers, cheapestLabel: offers[0].label };
  }
}
