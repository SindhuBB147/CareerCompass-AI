export interface StudentContext {
  rank?: number;
  examCode?: string;
  category?: string;
  domicileState?: string;
  budgetMax?: number;
  preferredCourses?: string[];
  preferredStates?: string[];
  riskAppetite?: string;
}

/**
 * Flattens a User document into the profile shape both the AI Counsellor
 * (context-aggregator.service.ts) and Smart Search (search.service.ts)
 * personalize against. Kept as a single shared function rather than one
 * feature duplicating the other's mapping — see the AiClientModule
 * extraction for the same rationale.
 */
export function buildStudentContext(user: any): StudentContext {
  if (!user) return {};
  const primaryExam = user.examProfiles?.[0];
  return {
    rank: primaryExam?.rank,
    examCode: primaryExam?.examCode,
    category: user.category,
    domicileState: user.domicileState,
    budgetMax: user.preferences?.budgetMax,
    preferredCourses: user.preferences?.preferredCourses,
    preferredStates: user.preferences?.preferredStates,
    riskAppetite: user.preferences?.riskAppetite,
  };
}
