export const SUPPORTED_EXAM_CODES = ['KCET', 'COMEDK', 'JEE', 'NEET'] as const;
export type SupportedExamCode = typeof SUPPORTED_EXAM_CODES[number];

export const SUPPORTED_STATES = ['Karnataka'] as const;

export const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS', '1G', '2A', '2B', '3A', '3B'] as const;

export const PROBABILITY_BANDS = {
  SAFE: { name: 'Safe', color: '#10B981', minPercent: 85 },
  MODERATE: { name: 'Moderate', color: '#3B82F6', minPercent: 50 },
  AMBITIOUS: { name: 'Ambitious', color: '#F59E0B', minPercent: 15 },
  REACH: { name: 'Reach', color: '#EF4444', minPercent: 0 },
} as const;

export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 20,
};
