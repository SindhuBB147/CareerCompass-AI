import { RoadmapGeneratorService } from '../../src/modules/roadmap/services/roadmap-generator.service';

function execReturning(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

describe('RoadmapGeneratorService', () => {
  let roadmapModel: any;
  let catalogService: any;
  let userRepo: any;
  let service: RoadmapGeneratorService;

  const template = {
    name: 'Software Engineer',
    toObject: () => ({
      phases: [
        {
          phaseKey: 'year_1', label: 'Year 1', order: 1,
          milestones: [
            { milestoneKey: 'year_1.foundations', title: 'Build core fundamentals', description: 'desc', category: 'skill', estimatedWeeks: 10, difficulty: 'beginner', priority: 'high', dependsOn: [], skills: ['Python', 'Git'], resources: [], certifications: [], projects: [] },
          ],
        },
        {
          phaseKey: 'year_2', label: 'Year 2', order: 2,
          milestones: [
            { milestoneKey: 'year_2.cert', title: 'Earn a certification', description: 'desc', category: 'certification', estimatedWeeks: 6, difficulty: 'intermediate', priority: 'medium', dependsOn: ['year_1.foundations'], skills: [], resources: [], certifications: [{ name: 'AWS', provider: 'AWS' }], projects: [] },
          ],
        },
      ],
    }),
  };

  beforeEach(() => {
    roadmapModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn().mockReturnValue(execReturning(undefined)),
    };
    catalogService = { getByCareerId: jest.fn().mockResolvedValue(template) };
    userRepo = { findById: jest.fn() };
    service = new RoadmapGeneratorService(roadmapModel, catalogService, userRepo);
  });

  describe('resolveDefaultCareerId', () => {
    it('returns null when the user does not exist', async () => {
      userRepo.findById.mockResolvedValue(null);
      expect(await service.resolveDefaultCareerId('user-1')).toBeNull();
    });

    it('resolves from an explicit career goal that matches a known career id', async () => {
      userRepo.findById.mockResolvedValue({ aiPersonalization: { careerGoal: 'Software Engineer' }, preferences: {} });
      expect(await service.resolveDefaultCareerId('user-1')).toBe('software-engineer');
    });

    it('falls back to a discipline mapping when there is no career goal', async () => {
      userRepo.findById.mockResolvedValue({ aiPersonalization: {}, preferences: { preferredDiscipline: 'CSE' } });
      expect(await service.resolveDefaultCareerId('user-1')).toBe('software-engineer');
    });

    it('returns null when neither a career goal nor a recognized discipline is present', async () => {
      userRepo.findById.mockResolvedValue({ aiPersonalization: {}, preferences: {} });
      expect(await service.resolveDefaultCareerId('user-1')).toBeNull();
    });
  });

  describe('generate', () => {
    it('auto-completes a skill milestone that matches the student\'s known skills and locks the dependent certification', async () => {
      userRepo.findById.mockResolvedValue({
        aiPersonalization: { skills: ['Python'], programmingLanguages: [] },
        preferences: {},
        academic: {},
      });
      roadmapModel.findOneAndUpdate.mockReturnValue(execReturning({ _id: 'roadmap-1', phases: [] }));

      await service.generate('user-1', 'software-engineer');

      const savedDoc = roadmapModel.findOneAndUpdate.mock.calls[0][1].$set;
      const foundations = savedDoc.phases[0].milestones[0];
      const cert = savedDoc.phases[1].milestones[0];
      expect(foundations.status).toBe('completed');
      expect(foundations.autoCompletedFromProfile).toBe(true);
      expect(cert.status).toBe('not_started'); // dependency (foundations) is completed, so it unlocks
    });

    it('locks a milestone whose dependency is not met', async () => {
      userRepo.findById.mockResolvedValue({ aiPersonalization: { skills: [], programmingLanguages: [] }, preferences: {}, academic: {} });
      roadmapModel.findOneAndUpdate.mockReturnValue(execReturning({ _id: 'roadmap-1', phases: [] }));

      await service.generate('user-1', 'software-engineer');

      const savedDoc = roadmapModel.findOneAndUpdate.mock.calls[0][1].$set;
      expect(savedDoc.phases[1].milestones[0].status).toBe('locked');
    });

    it('injects a higher-studies milestone into the final year phase when the student plans to pursue higher studies', async () => {
      const templateWithFinalYear = {
        name: 'Software Engineer',
        toObject: () => ({
          phases: [
            { phaseKey: 'final_year', label: 'Final Year', order: 4, milestones: [] },
          ],
        }),
      };
      catalogService.getByCareerId.mockResolvedValue(templateWithFinalYear);
      userRepo.findById.mockResolvedValue({ aiPersonalization: {}, preferences: { postGraduationPlan: 'higher_studies' }, academic: {} });
      roadmapModel.findOneAndUpdate.mockReturnValue(execReturning({ _id: 'roadmap-1', phases: [] }));

      await service.generate('user-1', 'software-engineer');

      const savedDoc = roadmapModel.findOneAndUpdate.mock.calls[0][1].$set;
      expect(savedDoc.phases[0].milestones.some((m: any) => m.category === 'higher_studies')).toBe(true);
    });
  });

  describe('getOrGenerate', () => {
    it('returns the existing roadmap without regenerating when one already exists for the career', async () => {
      const existing = { careerId: 'software-engineer', isActive: true };
      roadmapModel.findOne.mockReturnValueOnce(execReturning(existing)); // getByCareer (called first with explicit careerId)

      const result = await service.getOrGenerate('user-1', 'software-engineer');

      expect(result).toBe(existing);
      expect(roadmapModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('returns null when no careerId is given and none can be resolved from the profile', async () => {
      roadmapModel.findOne.mockReturnValue(execReturning(null)); // getActive
      userRepo.findById.mockResolvedValue({ aiPersonalization: {}, preferences: {} });

      const result = await service.getOrGenerate('user-1');

      expect(result).toBeNull();
    });
  });
});
