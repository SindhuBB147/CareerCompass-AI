import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Roadmap, RoadmapDocument } from '../models/roadmap.model';
import { CareerCatalogService } from './career-catalog.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { DomainException } from '../../../common/filters/domain.exception';
import { MilestoneTemplate, PhaseTemplate } from '../roadmap.types';
import { autoCompleteFromProfile, applyDependencyLocks, computeAnalytics } from '../utils/roadmap.util';

// Discipline/interest → default career mapping, used when a student hasn't
// explicitly picked a career but has a branch/interest on file. Mirrors the
// DISCIPLINE_SKILLS lookup the old inline RoadmapService used, extended to
// the full 33-career catalog.
const DISCIPLINE_TO_CAREER: Record<string, string> = {
  CSE: 'software-engineer', 'COMPUTER SCIENCE': 'software-engineer',
  ISE: 'full-stack-developer', 'INFORMATION SCIENCE': 'full-stack-developer', SOFTWARE: 'full-stack-developer',
  ECE: 'electronics-engineer', ELECTRONICS: 'electronics-engineer',
  ME: 'mechanical-engineer', MECHANICAL: 'mechanical-engineer',
  CE: 'civil-engineer', CIVIL: 'civil-engineer',
  EEE: 'electronics-engineer',
  BIOTECH: 'biotechnology', BIOTECHNOLOGY: 'biotechnology',
  MBBS: 'medical-careers', MEDICINE: 'medical-careers',
  BDS: 'dental-careers', DENTAL: 'dental-careers',
  AGRICULTURE: 'agriculture-careers', AGRI: 'agriculture-careers',
  VETERINARY: 'veterinary-careers',
};

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

@Injectable()
export class RoadmapGeneratorService {
  constructor(
    @InjectModel(Roadmap.name) private readonly roadmapModel: Model<RoadmapDocument>,
    private readonly catalogService: CareerCatalogService,
    private readonly userRepo: UserRepository,
  ) {}

  /** Best-effort career resolution from the student's profile, used when no explicit careerId is given. */
  async resolveDefaultCareerId(userId: string): Promise<string | null> {
    const user = await this.userRepo.findById(userId);
    if (!user) return null;
    return this.resolveFromUser(user);
  }

  private resolveFromUser(user: any): string | null {
    const goal: string | undefined = user.aiPersonalization?.careerGoal;
    if (goal) {
      const slug = normalize(goal);
      const byId = CAREER_ID_HINTS.find(id => id === slug || slug.includes(id) || id.includes(slug));
      if (byId) return byId;
    }
    const discipline: string | undefined = user.preferences?.preferredDiscipline ?? user.academic?.branch;
    if (discipline) {
      const upper = discipline.toUpperCase();
      for (const [key, careerId] of Object.entries(DISCIPLINE_TO_CAREER)) {
        if (upper.includes(key)) return careerId;
      }
    }
    return null;
  }

  /** Returns the student's currently-active roadmap, or null if none exists yet. */
  async getActive(userId: string): Promise<RoadmapDocument | null> {
    return this.roadmapModel.findOne({ userId, isActive: true }).exec();
  }

  async getByCareer(userId: string, careerId: string): Promise<RoadmapDocument | null> {
    return this.roadmapModel.findOne({ userId, careerId }).exec();
  }

  /**
   * Get-or-generate: if a roadmap already exists for this student+career,
   * it's returned as-is (progress is never silently reset) and marked
   * active. Only generates fresh when nothing exists yet.
   */
  async getOrGenerate(userId: string, careerId?: string): Promise<RoadmapDocument | null> {
    const resolvedCareerId = careerId ?? (await this.getActive(userId))?.careerId ?? (await this.resolveDefaultCareerId(userId));
    if (!resolvedCareerId) return null;

    const existing = await this.getByCareer(userId, resolvedCareerId);
    if (existing) {
      if (!existing.isActive) {
        await this.roadmapModel.updateMany({ userId, _id: { $ne: existing._id } }, { $set: { isActive: false } }).exec();
        existing.isActive = true;
        await existing.save();
      }
      return existing;
    }
    return this.generate(userId, resolvedCareerId);
  }

  /** Force (re)generation — used on explicit "switch career" / "regenerate" actions. */
  async generate(userId: string, careerId: string): Promise<RoadmapDocument> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new DomainException('NOT_FOUND', 'Student profile not found.', HttpStatus.NOT_FOUND);

    const template = await this.catalogService.getByCareerId(careerId);

    const knownSkills = [
      ...(user.aiPersonalization?.skills ?? []),
      ...(user.aiPersonalization?.programmingLanguages ?? []),
    ];

    const phases = (template.toObject().phases as PhaseTemplate[]).map(phase => ({
      phaseKey: phase.phaseKey,
      label: phase.label,
      order: phase.order,
      milestones: phase.milestones.map((ms: MilestoneTemplate) => ({
        ...ms,
        status: 'not_started',
        startedAt: null,
        completedAt: null,
        notes: this.budgetNote(ms, user),
        autoCompletedFromProfile: false,
        reminderSet: false,
      })),
    }));

    autoCompleteFromProfile(phases as any, knownSkills);

    if (user.preferences?.postGraduationPlan === 'higher_studies') {
      this.injectHigherStudiesGuidance(phases as any);
    }

    applyDependencyLocks(phases as any);

    const analytics = computeAnalytics(phases as any, new Date());

    const doc = await this.roadmapModel.findOneAndUpdate(
      { userId, careerId },
      {
        $set: {
          userId, careerId, careerName: template.name, isActive: true, generatedAt: new Date(),
          profileSnapshot: {
            currentSemester: user.academic?.currentSemester,
            branch: user.academic?.branch ?? user.preferences?.preferredDiscipline,
            knownSkills: user.aiPersonalization?.skills ?? [],
            knownLanguages: user.aiPersonalization?.programmingLanguages ?? [],
            budgetMax: user.preferences?.budgetMax,
            postGraduationPlan: user.preferences?.postGraduationPlan,
            careerGoal: user.aiPersonalization?.careerGoal,
          },
          phases,
          analytics,
        },
      },
      { new: true, upsert: true },
    ).exec();

    await this.roadmapModel.updateMany({ userId, _id: { $ne: doc._id } }, { $set: { isActive: false } }).exec();

    return doc;
  }

  private budgetNote(ms: MilestoneTemplate, user: any): string {
    const budget = user.preferences?.budgetMax;
    if (ms.category !== 'certification' || !budget || budget >= 50_000) return '';
    return 'Budget tip: look for the free-tier or student-discount version of this certification first.';
  }

  private injectHigherStudiesGuidance(phases: { phaseKey: string; milestones: any[] }[]): void {
    const hasHigherStudies = phases.some(p => p.milestones.some(ms => ms.category === 'higher_studies'));
    if (hasHigherStudies) return;
    const finalPhase = phases.find(p => p.phaseKey === 'final_year');
    if (!finalPhase) return;
    finalPhase.milestones.push({
      milestoneKey: 'final_year.explore_higher_studies_options',
      title: 'Explore higher studies options',
      description: 'Research GATE/GRE-based postgraduate programs relevant to your specialization and build a shortlist alongside your placement prep.',
      category: 'higher_studies', estimatedWeeks: 8, difficulty: 'intermediate', priority: 'medium',
      dependsOn: [], skills: ['Research'], resources: [], certifications: [], projects: [],
      status: 'not_started', startedAt: null, completedAt: null, notes: '', autoCompletedFromProfile: false, reminderSet: false,
    });
  }
}

const CAREER_ID_HINTS = [
  'software-engineer', 'ai-engineer', 'ml-engineer', 'data-scientist', 'cybersecurity-engineer',
  'cloud-engineer', 'devops-engineer', 'full-stack-developer', 'backend-developer', 'frontend-developer',
  'mobile-app-developer', 'game-developer', 'embedded-systems-engineer', 'electronics-engineer',
  'mechanical-engineer', 'civil-engineer', 'automobile-engineer', 'biomedical-engineer', 'biotechnology',
  'research-scientist', 'government-jobs', 'higher-studies', 'mba', 'ms-abroad', 'entrepreneurship',
  'freelancing', 'startup-founder', 'public-sector-jobs', 'medical-careers', 'dental-careers',
  'ayush-careers', 'agriculture-careers', 'veterinary-careers',
];
