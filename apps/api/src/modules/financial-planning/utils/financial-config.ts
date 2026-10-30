/**
 * Financial-module tuning constants — city cost-of-living tiers, fee
 * decomposition splits, and loan/ROI defaults.
 *
 * PHASE 2 SEAM: this stays plain TypeScript constants for now (admin CRUD
 * is explicitly out of scope for this phase — a DB collection only pays for
 * itself once there's a UI to edit it). `CityCostProfile` is shaped exactly
 * like a future Mongoose document would be, so promoting it to a small
 * collection later is a lift-and-shift (wrap the lookup in a repository
 * call), not a redesign.
 */

export type CityTier = 'tier1' | 'tier2' | 'tier3';

// City → cost tier. Only cities that actually appear in the college catalog
// (all seed colleges are in Bengaluru today) plus other well-known Karnataka
// college towns a student might type into the planner. Unknown/unlisted
// cities fall back to DEFAULT_CITY_TIER — a deliberately safe middle
// estimate rather than over- or under-estimating.
export const CITY_TIER_MAP: Record<string, CityTier> = {
  bengaluru: 'tier1', bangalore: 'tier1',
  mysuru: 'tier2', mysore: 'tier2',
  mangaluru: 'tier2', mangalore: 'tier2',
  hubli: 'tier2', dharwad: 'tier2', 'hubli-dharwad': 'tier2',
  belagavi: 'tier2', belgaum: 'tier2',
  kalaburagi: 'tier3', gulbarga: 'tier3',
  davangere: 'tier3', shivamogga: 'tier3', shimoga: 'tier3',
  tumakuru: 'tier3', tumkur: 'tier3',
  ballari: 'tier3', bellary: 'tier3',
  bidar: 'tier3', hassan: 'tier3', udupi: 'tier3', chikkamagaluru: 'tier3',
};

export const DEFAULT_CITY_TIER: CityTier = 'tier2';

export interface CityCostProfile {
  hostelMonthly: number;
  pgMonthly: number;
  apartmentShareMonthly: number;
  electricityMonthly: number;
  internetMonthly: number;
  laundryMonthly: number;
  foodMessMonthly: number;
  personalDailyExpenseMonthly: number;
  localTransportMonthly: number;
  medicalMiscMonthly: number;
}

export const CITY_COST_TIERS: Record<CityTier, CityCostProfile> = {
  tier1: {
    hostelMonthly: 9000, pgMonthly: 12000, apartmentShareMonthly: 10000,
    electricityMonthly: 900, internetMonthly: 600, laundryMonthly: 600,
    foodMessMonthly: 6000, personalDailyExpenseMonthly: 3000,
    localTransportMonthly: 2000, medicalMiscMonthly: 1000,
  },
  tier2: {
    hostelMonthly: 7000, pgMonthly: 8500, apartmentShareMonthly: 7000,
    electricityMonthly: 700, internetMonthly: 500, laundryMonthly: 500,
    foodMessMonthly: 5000, personalDailyExpenseMonthly: 2200,
    localTransportMonthly: 1400, medicalMiscMonthly: 800,
  },
  tier3: {
    hostelMonthly: 5500, pgMonthly: 6500, apartmentShareMonthly: 5500,
    electricityMonthly: 550, internetMonthly: 450, laundryMonthly: 400,
    foodMessMonthly: 4200, personalDailyExpenseMonthly: 1800,
    localTransportMonthly: 1000, medicalMiscMonthly: 700,
  },
};

// Local-transport monthly multiplier by transport preference, applied on
// top of CityCostProfile.localTransportMonthly. 'two_wheeler' costs more
// than public transport (fuel + maintenance); 'none' (walking distance /
// no regular commute) is zeroed.
export const TRANSPORT_PREFERENCE_MULTIPLIER: Record<'none' | 'public' | 'two_wheeler', number> = {
  none: 0, public: 1, two_wheeler: 1.4,
};

// Fee decomposition split — percentages of the annual "academic fee"
// (course.feePerYear ?? college.feeBreakdown.tuitionFee), since the DB
// doesn't itemize these sub-components separately. Must sum to 1.0.
export const ACADEMIC_FEE_SPLIT = {
  tuition: 0.72,
  developmentFee: 0.10,
  labFee: 0.08,
  libraryFee: 0.05,
  examFee: 0.05,
};

// One-time, Year-1-only estimated charges — not tracked in the DB at all.
export const YEAR1_ONE_TIME_DEFAULTS = {
  admissionFee: 15000,
  uniformEquipment: 8000,
  laptopRecommended: 55000,
};

// Recurring per-year estimated charges — not tracked in the DB.
export const RECURRING_ESTIMATE_DEFAULTS = {
  booksStationeryAnnual: 8000,
  internetMobileAnnual: 6000,
};

export const LOAN_DEFAULTS = {
  processingFeePercent: 1.0,
  processingFeeCap: 25000,
  // Used by the Financial Dashboard to auto-estimate an EMI for the
  // computed loan gap when the student hasn't specified loan terms.
  defaultInterestRate: 9.5,
  defaultTenureYears: 10,
};

export const ROI_DEFAULTS = {
  salaryGrowthRatePct: 8,
  horizonYears: 10,
  // Scholarship savings are capped at 100% of the fee base they're applied
  // against, so stacked scholarships can never drive net cost negative.
  scholarshipCapPctOfFee: 100,
};
