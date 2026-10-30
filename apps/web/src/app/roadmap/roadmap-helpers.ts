import type { MilestoneCategory, MilestoneStatus, Priority, Difficulty } from '../../lib/roadmap-api';

export const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  academic: 'Academic',
  skill: 'Skill',
  certification: 'Certification',
  internship: 'Internship / Exposure',
  project: 'Project',
  placement: 'Placement Prep',
  higher_studies: 'Higher Studies',
  soft_skill: 'Soft Skill',
  hackathon: 'Hackathon',
  competitive_programming: 'Practice',
};

export const CATEGORY_ICONS: Record<MilestoneCategory, string> = {
  academic: '📘',
  skill: '🛠️',
  certification: '🏆',
  internship: '💼',
  project: '🚀',
  placement: '🎯',
  higher_studies: '🎓',
  soft_skill: '🤝',
  hackathon: '⚡',
  competitive_programming: '🧠',
};

export const STATUS_LABELS: Record<MilestoneStatus, string> = {
  locked: 'Locked',
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const STATUS_COLORS: Record<MilestoneStatus, string> = {
  locked: 'var(--text-muted)',
  not_started: 'var(--text-secondary)',
  in_progress: 'var(--accent-blue)',
  completed: '#2E8B57',
};

export const PRIORITY_LABELS: Record<Priority, string> = { high: 'High Priority', medium: 'Medium Priority', low: 'Low Priority' };
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
