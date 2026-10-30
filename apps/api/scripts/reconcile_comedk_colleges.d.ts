export interface ReconciliationSource {
  code: string;
  name: string;
}

export interface CollegeCandidate {
  id: string;
  name: string | null;
  aliases: string[];
  collegeCode: string | null;
  alternateAdmissionCodes: Array<{ code: string; examBody: string; note?: string }>;
  address: string;
  city: string | null;
  district: string | null;
  state: string | null;
  accreditation: Record<string, unknown> | null | undefined;
  historicalNames: string[];
  similarity: number;
  locationTokenOverlap: number;
  evidence: string;
  confidence: string;
  distinctCampusWarning: boolean;
  exactName: boolean;
  exactAlias: boolean;
  exactHistoricalName: boolean;
  exactCode: boolean;
  automaticApproval: false;
}

export interface CandidateDiscovery {
  relevant: CollegeCandidate[];
  weakFuzzySuggestions: CollegeCandidate[];
  falsePositiveCandidatesExcluded: number;
}

export interface CollegeRecord {
  _id?: unknown;
  collegeId?: string;
  name?: string;
  aliasNames?: string[];
  historicalNames?: string[];
  alternateNames?: string[];
  code?: string;
  collegeCode?: string;
  alternateAdmissionCodes?: Array<{ code: string; examBody: string; note?: string }>;
  address?: string | Record<string, unknown>;
  contact?: { address?: string };
  city?: string;
  district?: string;
  state?: string;
  accreditation?: Record<string, unknown> | null;
}

export function normalize(value: string): string;
export function institutionName(value: string): string;
export function scoreTarget(source: ReconciliationSource, college: CollegeRecord): CollegeCandidate;
export function discoverCandidates(source: ReconciliationSource, colleges: CollegeRecord[]): CandidateDiscovery;
