import { ACADEMIC_FEE_SPLIT, YEAR1_ONE_TIME_DEFAULTS, RECURRING_ESTIMATE_DEFAULTS } from './financial-config';

export type FeeLineItemSource = 'db' | 'estimated';

export interface FeeLineItem {
  label: string;
  amount: number;
  source: FeeLineItemSource;
  recurring: boolean;
}

export interface YearlyFeeBreakdown {
  year: number;
  lineItems: FeeLineItem[];
  total: number;
}

export interface SemesterFeeBreakdown {
  year: number;
  semester: 1 | 2;
  lineItems: FeeLineItem[];
  total: number;
}

export interface ProgramFeeBreakdown {
  durationYears: number;
  yearly: YearlyFeeBreakdown[];
  semesterWise: SemesterFeeBreakdown[];
  /** Excludes the optional laptop recommendation. */
  totalProgramCost: number;
  totalProgramCostWithLaptop: number;
}

/**
 * Decomposes the DB's single annual fee figures into itemized line items
 * for display. The DB doesn't track sub-components (tuition vs lab vs
 * library, etc.) separately, so most sub-items are a documented percentage
 * split of the real total (`source: 'estimated'`) rather than independently
 * verified numbers — every line item is tagged so the UI can visually
 * distinguish real vs. derived figures.
 *
 * Phase 1 assumes a flat fee across all years (no per-year escalation
 * model — the DB has no per-year fee field) and even semester billing
 * (each year's recurring total is simply halved), except one-time Year-1
 * charges (admission fee etc.) which are paid entirely at joining, in
 * Semester 1.
 */
export function decomposeFeeIntoLineItems(input: {
  /** course.feePerYear ?? college.feeBreakdown.tuitionFee ?? 0 — REAL DB field. */
  academicFeePerYear: number;
  /** college.feeBreakdown.hostelFee ?? 0 — REAL, only applied if isHosteller. */
  hostelFeePerYear: number;
  /** college.feeBreakdown.messFee ?? 0 — REAL, only applied if isHosteller. */
  messFeePerYear: number;
  /** college.feeBreakdown.otherCharges ?? 0 — REAL, college-reported, not further decomposed. */
  otherChargesPerYear: number;
  /** course.durationYears — REAL. */
  durationYears: number;
  isHosteller: boolean;
  /** Estimated non-hostel living cost per year, from living-cost.util.ts — only used when NOT a hosteller. */
  livingCostNonHostelPerYear: number;
  includeLaptop?: boolean;
}): ProgramFeeBreakdown {
  const durationYears = Math.max(1, Math.round(input.durationYears));
  const yearly: YearlyFeeBreakdown[] = [];

  for (let year = 1; year <= durationYears; year++) {
    const lineItems: FeeLineItem[] = [
      { label: 'Tuition Fee', amount: round(input.academicFeePerYear * ACADEMIC_FEE_SPLIT.tuition), source: 'estimated', recurring: true },
      { label: 'Development Fee', amount: round(input.academicFeePerYear * ACADEMIC_FEE_SPLIT.developmentFee), source: 'estimated', recurring: true },
      { label: 'Laboratory Fee', amount: round(input.academicFeePerYear * ACADEMIC_FEE_SPLIT.labFee), source: 'estimated', recurring: true },
      { label: 'Library Fee', amount: round(input.academicFeePerYear * ACADEMIC_FEE_SPLIT.libraryFee), source: 'estimated', recurring: true },
      { label: 'Examination Fee', amount: round(input.academicFeePerYear * ACADEMIC_FEE_SPLIT.examFee), source: 'estimated', recurring: true },
      { label: 'University / Other Charges', amount: round(input.otherChargesPerYear), source: 'db', recurring: true },
      { label: 'Books & Stationery', amount: RECURRING_ESTIMATE_DEFAULTS.booksStationeryAnnual, source: 'estimated', recurring: true },
    ];

    if (input.isHosteller) {
      lineItems.push({ label: 'Hostel Fee', amount: round(input.hostelFeePerYear), source: 'db', recurring: true });
      lineItems.push({ label: 'Mess Charges', amount: round(input.messFeePerYear), source: 'db', recurring: true });
      lineItems.push({ label: 'Internet', amount: RECURRING_ESTIMATE_DEFAULTS.internetMobileAnnual, source: 'estimated', recurring: true });
    } else {
      lineItems.push({ label: 'Living Expenses (Day Scholar)', amount: round(input.livingCostNonHostelPerYear), source: 'estimated', recurring: true });
    }

    if (year === 1) {
      lineItems.push({ label: 'Admission Fee', amount: YEAR1_ONE_TIME_DEFAULTS.admissionFee, source: 'estimated', recurring: false });
      lineItems.push({ label: 'Uniform / Equipment', amount: YEAR1_ONE_TIME_DEFAULTS.uniformEquipment, source: 'estimated', recurring: false });
      if (input.includeLaptop) {
        lineItems.push({ label: 'Laptop (Recommended)', amount: YEAR1_ONE_TIME_DEFAULTS.laptopRecommended, source: 'estimated', recurring: false });
      }
    }

    yearly.push({ year, lineItems, total: sumLineItems(lineItems) });
  }

  const semesterWise: SemesterFeeBreakdown[] = [];
  for (const y of yearly) {
    const recurringItems = y.lineItems.filter(li => li.recurring);
    const oneTimeItems = y.lineItems.filter(li => !li.recurring);

    const sem1Items = [
      ...recurringItems.map(li => ({ ...li, amount: round(li.amount / 2) })),
      ...oneTimeItems, // one-time Year-1 charges paid entirely at joining
    ];
    const sem2Items = recurringItems.map(li => ({ ...li, amount: round(li.amount / 2) }));

    semesterWise.push({ year: y.year, semester: 1, lineItems: sem1Items, total: sumLineItems(sem1Items) });
    semesterWise.push({ year: y.year, semester: 2, lineItems: sem2Items, total: sumLineItems(sem2Items) });
  }

  const totalProgramCost = yearly.reduce(
    (sum, y) => sum + y.lineItems.filter(li => li.label !== 'Laptop (Recommended)').reduce((s, li) => s + li.amount, 0),
    0,
  );
  const totalProgramCostWithLaptop = totalProgramCost
    + (input.includeLaptop ? YEAR1_ONE_TIME_DEFAULTS.laptopRecommended : 0);

  return {
    durationYears,
    yearly,
    semesterWise,
    totalProgramCost: round(totalProgramCost),
    totalProgramCostWithLaptop: round(totalProgramCostWithLaptop),
  };
}

function sumLineItems(items: FeeLineItem[]): number {
  return round(items.reduce((sum, li) => sum + li.amount, 0));
}

function round(n: number): number {
  return Math.round(n);
}
