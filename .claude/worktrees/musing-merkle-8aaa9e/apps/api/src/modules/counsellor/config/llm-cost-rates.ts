/**
 * Approximate public list pricing (USD per 1,000 tokens) for the LLM
 * providers this project's ai-service can be configured with. Used only to
 * estimate cost for the admin usage dashboard — not billing-grade, since
 * providers change pricing without notice. Update these constants when a
 * provider's pricing changes; there is deliberately no admin UI for this
 * (see the AI Counsellor completion plan) since it's an infrequent ops
 * concern reviewable via a normal PR, not a runtime setting.
 */
export interface CostRate {
  inputPer1k: number;
  outputPer1k: number;
}

const ZERO_COST: CostRate = { inputPer1k: 0, outputPer1k: 0 };

const LLM_COST_RATES: Record<string, Record<string, CostRate>> = {
  openai: {
    'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
    'gpt-4o': { inputPer1k: 0.0025, outputPer1k: 0.01 },
    default: { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  },
  azure_openai: {
    // Azure deployment names are operator-chosen and unpredictable, so this
    // provider always falls back to `default` — closest to the common
    // gpt-4o-mini deployment most setups use.
    default: { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  },
  gemini: {
    'gemini-1.5-flash': { inputPer1k: 0.000075, outputPer1k: 0.0003 },
    'gemini-1.5-pro': { inputPer1k: 0.00125, outputPer1k: 0.005 },
    default: { inputPer1k: 0.000075, outputPer1k: 0.0003 },
  },
  ollama: {
    default: ZERO_COST, // self-hosted, no per-token billing
  },
  fallback: {
    default: ZERO_COST, // deterministic template provider, no external call
  },
};

export function getCostRate(provider: string | undefined, model: string | undefined): CostRate {
  const providerRates = LLM_COST_RATES[provider ?? ''];
  if (!providerRates) return ZERO_COST;
  return providerRates[model ?? ''] ?? providerRates.default ?? ZERO_COST;
}

export function estimateCostUsd(
  provider: string | undefined,
  model: string | undefined,
  tokensIn: number,
  tokensOut: number,
): number {
  const rate = getCostRate(provider, model);
  return (tokensIn / 1000) * rate.inputPer1k + (tokensOut / 1000) * rate.outputPer1k;
}
