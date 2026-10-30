// Typed client for the Career Roadmap module. Mirrors financial-api.ts's
// conventions (thin apiClient wrappers, types re-declared here rather than
// shared with the backend).

import { apiClient } from './api-client';

export type CareerCategory =
  | 'engineering_tech' | 'core_engineering' | 'sciences_research' | 'government_public_sector'
  | 'higher_studies' | 'entrepreneurship' | 'medical_health' | 'agriculture_veterinary';

export type MilestoneCategory =
  | 'academic' | 'skill' | 'certification' | 'internship' | 'project' | 'placement'
  | 'higher_studies' | 'soft_skill' | 'hackathon' | 'competitive_programming';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type Priority = 'low' | 'medium' | 'high';
export type MilestoneStatus = 'locked' | 'not_started' | 'in_progress' | 'completed';

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

export interface MilestoneInstance {
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
  status: MilestoneStatus;
  startedAt: string | null;
  completedAt: string | null;
  notes: string;
  autoCompletedFromProfile: boolean;
  reminderSet: boolean;
}

export interface PhaseInstance {
  phaseKey: string;
  label: string;
  order: number;
  milestones: MilestoneInstance[];
}

export interface RoadmapAnalytics {
  completionPercent: number;
  completedCount: number;
  totalCount: number;
  inProgressCount: number;
  upcomingCount: number;
  missedCount: number;
  learningHoursLogged: number;
  skillScore: number;
  achievements: { key: string; label: string; earnedAt: string }[];
}

export interface Roadmap {
  _id: string;
  userId: string;
  careerId: string;
  careerName: string;
  isActive: boolean;
  generatedAt: string;
  phases: PhaseInstance[];
  analytics: RoadmapAnalytics;
  shareToken: string | null;
  shareEnabled: boolean;
}

export interface CareerSummary {
  careerId: string;
  name: string;
  category: CareerCategory;
  description: string;
  tags: string[];
  phaseCount: number;
  milestoneCount: number;
}

export interface RoadmapRecommendations {
  skillsToImprove: string[];
  coursesToLearn: ResourceRef[];
  projectsToTry: ProjectRef[];
  certificationsToTarget: CertificationRef[];
  alternativeCareerPaths: { careerId: string; name: string; reason: string }[];
}

export interface SharedRoadmap {
  careerName: string;
  generatedAt: string;
  analytics: RoadmapAnalytics;
  phases: {
    phaseKey: string;
    label: string;
    order: number;
    milestones: Pick<MilestoneInstance, 'title' | 'description' | 'category' | 'difficulty' | 'priority' | 'status' | 'skills'>[];
  }[];
}

export const CAREER_CATEGORY_LABELS: Record<CareerCategory, string> = {
  engineering_tech: 'Engineering & Technology',
  core_engineering: 'Core Engineering',
  sciences_research: 'Sciences & Research',
  government_public_sector: 'Government & Public Sector',
  higher_studies: 'Higher Studies',
  entrepreneurship: 'Entrepreneurship & Freelancing',
  medical_health: 'Medical & Health Sciences',
  agriculture_veterinary: 'Agriculture & Veterinary Sciences',
};

export const roadmapApi = {
  getCareers: (token: string, category?: CareerCategory) =>
    apiClient.get<CareerSummary[]>(`/career-roadmap/careers${category ? `?category=${category}` : ''}`, token),
  getRoadmap: (token: string, careerId?: string) =>
    apiClient.get<Roadmap | null>(`/career-roadmap${careerId ? `?careerId=${encodeURIComponent(careerId)}` : ''}`, token),
  generateRoadmap: (token: string, careerId: string) =>
    apiClient.post<Roadmap>('/career-roadmap/generate', { careerId }, token),
  updateMilestone: (token: string, milestoneKey: string, patch: { status?: MilestoneStatus; notes?: string }) =>
    apiClient.patch<Roadmap>(`/career-roadmap/milestones/${encodeURIComponent(milestoneKey)}`, patch, token),
  getAnalytics: (token: string) => apiClient.get<RoadmapAnalytics>('/career-roadmap/analytics', token),
  getRecommendations: (token: string) => apiClient.get<RoadmapRecommendations>('/career-roadmap/recommendations', token),
  enableShare: (token: string) => apiClient.post<{ shareToken: string }>('/career-roadmap/share', undefined, token),
  disableShare: (token: string) => apiClient.post<{ shareEnabled: boolean }>('/career-roadmap/share/disable', undefined, token),
  getShared: (shareToken: string) => apiClient.get<SharedRoadmap>(`/career-roadmap/shared/${shareToken}`),
};
