import {
  CITY_TIER_MAP, CITY_COST_TIERS, DEFAULT_CITY_TIER, TRANSPORT_PREFERENCE_MULTIPLIER, CityTier,
} from './financial-config';

export type AccommodationType = 'hostel' | 'pg' | 'apartment_shared' | 'day_scholar';
export type TransportPreference = 'none' | 'public' | 'two_wheeler';

export interface LivingCostBreakdown {
  accommodationType: AccommodationType;
  cityTier: CityTier;
  rentOrHostelMonthly: number;
  electricityMonthly: number;
  internetMonthly: number;
  laundryMonthly: number;
  foodMonthly: number;
  personalMonthly: number;
  transportMonthly: number;
  medicalMiscMonthly: number;
  totalMonthly: number;
  totalAnnual: number;
}

/** Case-insensitive city → cost tier lookup. Unlisted cities default to tier2. */
export function resolveCityTier(city: string | undefined | null): CityTier {
  if (!city) return DEFAULT_CITY_TIER;
  return CITY_TIER_MAP[city.trim().toLowerCase()] ?? DEFAULT_CITY_TIER;
}

/** Full monthly/annual living-cost breakdown for a given city + accommodation choice. */
export function estimateLivingCost(params: {
  city: string | undefined | null;
  accommodationType: AccommodationType;
  transportPreference?: TransportPreference;
}): LivingCostBreakdown {
  const cityTier = resolveCityTier(params.city);
  const tier = CITY_COST_TIERS[cityTier];

  const rentOrHostelMonthly =
    params.accommodationType === 'hostel' ? tier.hostelMonthly :
    params.accommodationType === 'pg' ? tier.pgMonthly :
    params.accommodationType === 'apartment_shared' ? tier.apartmentShareMonthly :
    0; // day_scholar: living at home, no rent

  const transportMultiplier = TRANSPORT_PREFERENCE_MULTIPLIER[params.transportPreference ?? 'public'];
  const transportMonthly = Math.round(tier.localTransportMonthly * transportMultiplier);

  const electricityMonthly = params.accommodationType === 'day_scholar' ? 0 : tier.electricityMonthly;
  const internetMonthly = params.accommodationType === 'day_scholar' ? 0 : tier.internetMonthly;
  const laundryMonthly = params.accommodationType === 'day_scholar' ? 0 : tier.laundryMonthly;
  const foodMonthly = tier.foodMessMonthly;
  const personalMonthly = tier.personalDailyExpenseMonthly;
  const medicalMiscMonthly = tier.medicalMiscMonthly;

  const totalMonthly = rentOrHostelMonthly + electricityMonthly + internetMonthly + laundryMonthly
    + foodMonthly + personalMonthly + transportMonthly + medicalMiscMonthly;

  return {
    accommodationType: params.accommodationType,
    cityTier,
    rentOrHostelMonthly, electricityMonthly, internetMonthly, laundryMonthly,
    foodMonthly, personalMonthly, transportMonthly, medicalMiscMonthly,
    totalMonthly: Math.round(totalMonthly),
    totalAnnual: Math.round(totalMonthly * 12),
  };
}

/**
 * Narrower helper for callers (e.g. PredictionService.getRoi()) that only
 * need a single annual living-cost figure, not the full itemized
 * breakdown. Defaults to hostel accommodation + public transport — the
 * typical "away from home" assumption ROI uses.
 */
export function estimateAnnualLivingCost(
  city: string | undefined | null,
  isHosteller: boolean,
): number {
  return estimateLivingCost({
    city,
    accommodationType: isHosteller ? 'hostel' : 'day_scholar',
    transportPreference: isHosteller ? 'public' : 'none',
  }).totalAnnual;
}
