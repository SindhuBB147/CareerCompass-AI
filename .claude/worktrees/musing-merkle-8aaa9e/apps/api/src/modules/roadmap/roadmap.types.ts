// Shared vocabulary for the Career Roadmap module — used by the
// CareerTemplate schema (admin-managed source data), the Roadmap schema
// (per-student generated instance), and every roadmap service. Keeping
// these in one file means the frontend's roadmap-api.ts type strings and
// the backend enums can never silently drift apart.

export const CAREER_CATEGORIES = [
  'engineering_tech',
  'core_engineering',
  'sciences_research',
  'government_public_sector',
  'higher_studies',
  'entrepreneurship',
  'medical_health',
  'agriculture_veterinary',
] as const;
export type CareerCategory = typeof CAREER_CATEGORIES[number];

export const PHASE_KEYS = [
  'before_admission',
  'year_1',
  'year_2',
  'year_3',
  'final_year',
  'placement_or_higher_studies',
] as const;
export type PhaseKey = typeof PHASE_KEYS[number];

export const MILESTONE_CATEGORIES = [
  'academic',
  'skill',
  'certification',
  'internship',
  'project',
  'placement',
  'higher_studies',
  'soft_skill',
  'hackathon',
  'competitive_programming',
] as const;
export type MilestoneCategory = typeof MILESTONE_CATEGORIES[number];

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type Difficulty = typeof DIFFICULTIES[number];

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = typeof PRIORITIES[number];

export const MILESTONE_STATUSES = ['locked', 'not_started', 'in_progress', 'completed'] as const;
export type MilestoneStatus = typeof MILESTONE_STATUSES[number];

export interface ResourceRef {
  title: string;
  url?: string;
  provider: string;
  type: 'documentation' | 'course' | 'video' | 'book' | 'practice_platform' | 'repository' | 'paper' | 'article';
}

export interface CertificationRef {
  name: string;
  provider: string;
  url?: string;
}

export interface ProjectRef {
  title: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'industry' | 'open_source' | 'research' | 'portfolio' | 'hackathon';
  description: string;
}

export interface MilestoneTemplate {
  milestoneKey: string;
  title: string;
  description: string;
  category: MilestoneCategory;
  estimatedWeeks: number;
  difficulty: Difficulty;
  priority: Priority;
  dependsOn: string[];
  skills: string[];
  resources: ResourceRef[];
  certifications: CertificationRef[];
  projects: ProjectRef[];
}

export interface PhaseTemplate {
  phaseKey: PhaseKey;
  label: string;
  order: number;
  milestones: MilestoneTemplate[];
}
