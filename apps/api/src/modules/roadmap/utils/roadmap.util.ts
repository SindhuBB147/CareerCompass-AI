// Pure functions over the roadmap phases/milestones shape — no I/O, no
// Mongoose — so they're cheap to unit test in isolation (mirrors the
// fee-breakdown.util.ts / loan-amortization.util.ts convention already
// used by the Financial Planning module).

export interface MilestoneInstanceLike {
  milestoneKey: string;
  category: string;
  skills: string[];
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  notes: string;
  autoCompletedFromProfile: boolean;
  dependsOn: string[];
  priority: string;
  estimatedWeeks: number;
}

export interface PhaseInstanceLike {
  phaseKey: string;
  milestones: MilestoneInstanceLike[];
}

/** Loose containment match — "React" known matches milestone skill "React (or similar)". */
function skillIsKnown(milestoneSkill: string, knownSkills: string[]): boolean {
  const target = milestoneSkill.toLowerCase();
  return knownSkills.some(known => {
    const k = known.toLowerCase().trim();
    if (!k) return false;
    return target.includes(k) || k.includes(target);
  });
}

/**
 * Marks skill/academic milestones the student has already demonstrated
 * (via their profile's known skills/programming languages) as completed,
 * so the generated roadmap doesn't ask them to re-learn what they already
 * know. Requires at least half the milestone's listed skills to match —
 * a single incidental overlap isn't enough to auto-complete a milestone.
 */
export function autoCompleteFromProfile(phases: PhaseInstanceLike[], knownSkills: string[]): void {
  if (knownSkills.length === 0) return;
  for (const phase of phases) {
    for (const milestone of phase.milestones) {
      if (milestone.category !== 'skill' && milestone.category !== 'academic') continue;
      if (milestone.skills.length === 0) continue;
      const matched = milestone.skills.filter(s => skillIsKnown(s, knownSkills));
      if (matched.length >= Math.ceil(milestone.skills.length / 2)) {
        milestone.status = 'completed';
        milestone.completedAt = milestone.completedAt ?? new Date();
        milestone.autoCompletedFromProfile = true;
        milestone.notes = milestone.notes || `Auto-detected from your profile (already know: ${matched.join(', ')}).`;
      }
    }
  }
}

/**
 * A milestone is locked until every milestone it depends on is completed.
 * Runs after autoCompleteFromProfile so profile-based completions can
 * unlock dependents immediately. Safe to re-run any time progress changes.
 */
export function applyDependencyLocks(phases: PhaseInstanceLike[]): void {
  const completed = new Set<string>();
  for (const phase of phases) {
    for (const milestone of phase.milestones) {
      if (milestone.status === 'completed') completed.add(milestone.milestoneKey);
    }
  }
  for (const phase of phases) {
    for (const milestone of phase.milestones) {
      if (milestone.status === 'completed' || milestone.status === 'in_progress') continue;
      const blocked = milestone.dependsOn.some(dep => !completed.has(dep));
      milestone.status = blocked ? 'locked' : 'not_started';
    }
  }
}

export interface AnalyticsResult {
  completionPercent: number;
  completedCount: number;
  totalCount: number;
  inProgressCount: number;
  upcomingCount: number;
  missedCount: number;
  learningHoursLogged: number;
  skillScore: number;
  achievements: { key: string; label: string; earnedAt: Date }[];
}

/**
 * Recomputed on every generate/progress-update rather than incrementally
 * tracked, since the roadmap's phase/milestone list changes shape when a
 * career switches or a template is edited by an admin — recomputing from
 * the current milestone list is simpler and can't drift out of sync.
 */
export function computeAnalytics(phases: PhaseInstanceLike[], generatedAt: Date): AnalyticsResult {
  const all = phases.flatMap(p => p.milestones);
  const totalCount = all.length;
  const completed = all.filter(m => m.status === 'completed');
  const inProgress = all.filter(m => m.status === 'in_progress');
  const now = Date.now();

  // "Upcoming" = not started/in-progress and estimated to be due soon based
  // on cumulative estimatedWeeks from generation; "missed" = same but the
  // estimated window has already passed. Approximate by design — there's
  // no per-milestone due date, only a relative duration.
  let cumulativeWeeks = 0;
  let upcomingCount = 0;
  let missedCount = 0;
  for (const phase of phases) {
    for (const milestone of phase.milestones) {
      cumulativeWeeks += milestone.estimatedWeeks;
      if (milestone.status === 'completed') continue;
      const dueAt = generatedAt.getTime() + cumulativeWeeks * 7 * 24 * 60 * 60 * 1000;
      const weeksUntilDue = (dueAt - now) / (7 * 24 * 60 * 60 * 1000);
      if (weeksUntilDue < 0) missedCount++;
      else if (weeksUntilDue <= 4) upcomingCount++;
    }
  }

  const learningHoursLogged = completed.reduce((sum, m) => sum + m.estimatedWeeks * 5, 0); // ~5 focused hours/week assumption

  // Skill score: weighted completion, priority-adjusted, 0-100.
  const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const totalWeight = all.reduce((sum, m) => sum + (priorityWeight[m.priority] ?? 2), 0);
  const earnedWeight = completed.reduce((sum, m) => sum + (priorityWeight[m.priority] ?? 2), 0);
  const skillScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  const achievements: AnalyticsResult['achievements'] = [];
  const milestonePercents = [25, 50, 75, 100];
  const completionPercent = totalCount > 0 ? Math.round((completed.length / totalCount) * 100) : 0;
  for (const pct of milestonePercents) {
    if (completionPercent >= pct) {
      achievements.push({ key: `progress_${pct}`, label: `${pct}% roadmap complete`, earnedAt: new Date() });
    }
  }
  if (completed.some(m => m.category === 'certification')) {
    achievements.push({ key: 'first_certification', label: 'Earned your first certification milestone', earnedAt: new Date() });
  }
  if (completed.some(m => m.category === 'internship')) {
    achievements.push({ key: 'first_internship', label: 'Completed an internship/exposure milestone', earnedAt: new Date() });
  }
  if (completed.some(m => m.category === 'project')) {
    achievements.push({ key: 'first_project', label: 'Shipped your first roadmap project', earnedAt: new Date() });
  }

  return {
    completionPercent,
    completedCount: completed.length,
    totalCount,
    inProgressCount: inProgress.length,
    upcomingCount,
    missedCount,
    learningHoursLogged,
    skillScore,
    achievements,
  };
}
