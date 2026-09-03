import { RoadmapRecommendationService } from '../../src/modules/roadmap/services/roadmap-recommendation.service';
import { DomainException } from '../../src/common/filters/domain.exception';

function execReturning(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function makeMilestone(overrides: Partial<any> = {}) {
  return {
    milestoneKey: 'm', title: 't', category: 'skill', priority: 'medium', status: 'not_started',
    skills: [], resources: [], certifications: [], projects: [],
    ...overrides,
  };
}

describe('RoadmapRecommendationService', () => {
  let roadmapModel: any;
  let catalogService: any;
  let service: RoadmapRecommendationService;

  beforeEach(() => {
    roadmapModel = { findOne: jest.fn() };
    catalogService = {
      getByCareerId: jest.fn().mockResolvedValue({ tags: ['CSE', 'programming'] }),
      listSummaries: jest.fn().mockResolvedValue([]),
    };
    service = new RoadmapRecommendationService(roadmapModel, catalogService);
  });

  it('throws NOT_FOUND when the student has no active roadmap', async () => {
    roadmapModel.findOne.mockReturnValue(execReturning(null));
    await expect(service.getRecommendations('user-1')).rejects.toThrow(DomainException);
  });

  it('excludes completed and locked milestones from focus recommendations', async () => {
    roadmapModel.findOne.mockReturnValue(execReturning({
      careerId: 'software-engineer',
      phases: [{ milestones: [
        makeMilestone({ status: 'completed', skills: ['Should Not Appear'] }),
        makeMilestone({ status: 'locked', skills: ['Also Should Not Appear'] }),
        makeMilestone({ status: 'not_started', skills: ['DSA'] }),
      ] }],
    }));

    const result = await service.getRecommendations('user-1');

    expect(result.skillsToImprove).toEqual(['DSA']);
  });

  it('prioritizes high-priority incomplete milestones over low-priority ones', async () => {
    roadmapModel.findOne.mockReturnValue(execReturning({
      careerId: 'software-engineer',
      phases: [{ milestones: [
        makeMilestone({ status: 'not_started', priority: 'low', skills: ['Low Priority Skill'] }),
        makeMilestone({ status: 'not_started', priority: 'high', skills: ['High Priority Skill'] }),
      ] }],
    }));

    const result = await service.getRecommendations('user-1');

    expect(result.skillsToImprove[0]).toBe('High Priority Skill');
  });

  it('collects projects only from incomplete project-category milestones', async () => {
    roadmapModel.findOne.mockReturnValue(execReturning({
      careerId: 'software-engineer',
      phases: [{ milestones: [
        makeMilestone({ status: 'not_started', category: 'project', projects: [{ title: 'Build a CLI tool', level: 'beginner', description: 'd' }] }),
        makeMilestone({ status: 'not_started', category: 'skill', projects: [{ title: 'Should not appear', level: 'beginner', description: 'd' }] }),
      ] }],
    }));

    const result = await service.getRecommendations('user-1');

    expect(result.projectsToTry).toEqual([{ title: 'Build a CLI tool', level: 'beginner', description: 'd' }]);
  });

  it('suggests alternative careers that share tags, sorted by overlap, excluding the current career', async () => {
    catalogService.listSummaries.mockResolvedValue([
      { careerId: 'software-engineer', name: 'Software Engineer', tags: ['CSE', 'programming'] },
      { careerId: 'full-stack-developer', name: 'Full Stack Developer', tags: ['CSE', 'ISE', 'web'] },
      { careerId: 'civil-engineer', name: 'Civil Engineer', tags: ['CE', 'civil'] },
    ]);
    roadmapModel.findOne.mockReturnValue(execReturning({ careerId: 'software-engineer', phases: [] }));

    const result = await service.getRecommendations('user-1');

    expect(result.alternativeCareerPaths.map(c => c.careerId)).toEqual(['full-stack-developer']);
    expect(result.alternativeCareerPaths.every(c => c.careerId !== 'software-engineer')).toBe(true);
  });
});
