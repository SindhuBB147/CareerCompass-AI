import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Roadmap, RoadmapDocument } from '../models/roadmap.model';
import { CareerCatalogService } from './career-catalog.service';
import { DomainException } from '../../../common/filters/domain.exception';
import { ResourceRef, CertificationRef, ProjectRef } from '../roadmap.types';

export interface RoadmapRecommendations {
  skillsToImprove: string[];
  coursesToLearn: ResourceRef[];
  projectsToTry: ProjectRef[];
  certificationsToTarget: CertificationRef[];
  alternativeCareerPaths: { careerId: string; name: string; reason: string }[];
}

/**
 * Deterministic "what should I focus on next" engine — analyzes the
 * active roadmap's incomplete, high-priority milestones against the
 * student's profile rather than calling an LLM. This is what the
 * roadmap's "AI Recommendations" panel reads; open-ended free-form
 * questions ("what should I learn next?") instead go through the
 * existing AI Counsellor (see ContextAggregatorService), which is
 * already grounded on this same roadmap data.
 */
@Injectable()
export class RoadmapRecommendationService {
  constructor(
    @InjectModel(Roadmap.name) private readonly roadmapModel: Model<RoadmapDocument>,
    private readonly catalogService: CareerCatalogService,
  ) {}

  async getRecommendations(userId: string): Promise<RoadmapRecommendations> {
    const doc = await this.roadmapModel.findOne({ userId, isActive: true }).exec();
    if (!doc) throw new DomainException('NOT_FOUND', 'No active roadmap. Generate one first.', HttpStatus.NOT_FOUND);

    const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const incomplete = doc.phases
      .flatMap(p => p.milestones)
      .filter(m => m.status !== 'completed' && m.status !== 'locked')
      .sort((a, b) => (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1));

    const topFocus = incomplete.slice(0, 6);

    const skillsToImprove = Array.from(new Set(topFocus.flatMap(m => m.skills))).slice(0, 8);
    const coursesToLearn = dedupBy(topFocus.flatMap(m => m.resources), r => r.title).slice(0, 6) as unknown as ResourceRef[];
    const projectsToTry = dedupBy(
      incomplete.filter(m => m.category === 'project').flatMap(m => m.projects),
      p => p.title,
    ).slice(0, 4) as unknown as ProjectRef[];
    const certificationsToTarget = dedupBy(
      incomplete.filter(m => m.category === 'certification').flatMap(m => m.certifications),
      c => c.name,
    ).slice(0, 4) as unknown as CertificationRef[];

    const alternativeCareerPaths = await this.suggestAlternativeCareers(doc.careerId);

    return { skillsToImprove, coursesToLearn, projectsToTry, certificationsToTarget, alternativeCareerPaths };
  }

  private async suggestAlternativeCareers(currentCareerId: string): Promise<{ careerId: string; name: string; reason: string }[]> {
    const current = await this.catalogService.getByCareerId(currentCareerId);
    const summaries = await this.catalogService.listSummaries();
    const currentTags = new Set(current.tags.map(t => t.toLowerCase()));

    const scored = summaries
      .filter(s => s.careerId !== currentCareerId)
      .map(s => ({
        s,
        overlap: s.tags.filter(t => currentTags.has(t.toLowerCase())).length,
      }))
      .filter(x => x.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 3);

    return scored.map(({ s, overlap }) => ({
      careerId: s.careerId,
      name: s.name,
      reason: `Shares ${overlap} skill area${overlap === 1 ? '' : 's'} with your current path — worth a look if you're weighing options.`,
    }));
  }
}

function dedupBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
