import { LOAN_DEFAULTS } from './financial-config';

export interface YearlyEmiGroup {
  year: number;
  openingBalance: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  closingBalance: number;
}

export interface MonthlyEmiEntry {
  month: number;
  emi: number;
  principalPaid: number;
  interestPaid: number;
  balanceRemaining: number;
}

export interface AmortizationResult {
  principal: number;
  interestRate: number;
  tenureYears: number;
  moratoriumMonths: number;
  moratoriumInterestAccrued: number;
  monthlyEmi: number;
  totalInterest: number;
  totalPayment: number;
  processingFeeAmount: number;
  /** totalPayment + processingFeeAmount — the all-in cost of the loan. */
  totalCostOfLoan: number;
  yearlySchedule: YearlyEmiGroup[];
  monthlySchedule?: MonthlyEmiEntry[];
}

/**
 * Reducing-balance EMI amortization with moratorium support.
 *
 * Moratorium: interest accrues (simple interest) during the moratorium
 * period and is added to the principal before EMI computation — the
 * student pays no EMI during the moratorium, but the accrued interest
 * inflates the principal the EMI schedule is calculated against.
 *
 * Processing fee is assumed paid upfront/separately by the family (typical
 * education-loan practice), NOT netted from the disbursed principal — it
 * does not affect the EMI formula, only `totalCostOfLoan`.
 */
export function amortize(input: {
  loanAmount: number;
  interestRate: number;
  tenureYears: number;
  moratoriumMonths?: number;
  processingFeePercent?: number;
  processingFeeCap?: number;
  includeMonthlySchedule?: boolean;
}): AmortizationResult {
  const P = input.loanAmount;
  const annualRate = input.interestRate;
  const r = annualRate / 12 / 100;
  const n = Math.round(input.tenureYears * 12);
  const moratorium = input.moratoriumMonths ?? 0;

  const moratoriumInterest = (P * annualRate * (moratorium / 12)) / 100;
  const principalAfterMoratorium = P + moratoriumInterest;

  const emi = r === 0
    ? principalAfterMoratorium / n
    : (principalAfterMoratorium * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  const totalPayment = emi * n + (P - principalAfterMoratorium);
  const totalInterest = totalPayment - P;

  const processingFeePercent = input.processingFeePercent ?? LOAN_DEFAULTS.processingFeePercent;
  const processingFeeCap = input.processingFeeCap ?? LOAN_DEFAULTS.processingFeeCap;
  const processingFeeAmount = Math.min((P * processingFeePercent) / 100, processingFeeCap);

  let balance = principalAfterMoratorium;
  const monthlySchedule: MonthlyEmiEntry[] = [];
  const yearlySchedule: YearlyEmiGroup[] = [];
  let yearOpening = balance;
  let yearPrincipal = 0;
  let yearInterest = 0;

  for (let m = 1; m <= n; m++) {
    const interestPaid = balance * r;
    const principalPaid = Math.min(emi - interestPaid, balance);
    balance = Math.max(0, balance - principalPaid);

    if (input.includeMonthlySchedule) {
      monthlySchedule.push({
        month: m,
        emi: Math.round(emi),
        principalPaid: Math.round(principalPaid),
        interestPaid: Math.round(interestPaid),
        balanceRemaining: Math.round(balance),
      });
    }

    yearPrincipal += principalPaid;
    yearInterest += interestPaid;

    if (m % 12 === 0 || m === n) {
      yearlySchedule.push({
        year: Math.ceil(m / 12),
        openingBalance: Math.round(yearOpening),
        totalPrincipalPaid: Math.round(yearPrincipal),
        totalInterestPaid: Math.round(yearInterest),
        closingBalance: Math.round(balance),
      });
      yearOpening = balance;
      yearPrincipal = 0;
      yearInterest = 0;
    }
  }

  return {
    principal: P,
    interestRate: annualRate,
    tenureYears: input.tenureYears,
    moratoriumMonths: moratorium,
    moratoriumInterestAccrued: Math.round(moratoriumInterest),
    monthlyEmi: Math.round(emi),
    totalInterest: Math.round(totalInterest),
    totalPayment: Math.round(totalPayment),
    processingFeeAmount: Math.round(processingFeeAmount),
    totalCostOfLoan: Math.round(totalPayment + processingFeeAmount),
    yearlySchedule,
    monthlySchedule: input.includeMonthlySchedule ? monthlySchedule : undefined,
  };
}
