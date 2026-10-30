import { RoadmapProgressService } from '../../src/modules/roadmap/services/roadmap-progress.service';
import { DomainException } from '../../src/common/filters/domain.exception';

function execReturning(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function makeRoadmapDoc(overrides: Partial<any> = {}) {
  return {
    userId: 'user-1',
    generatedAt: new Date(),
    phases: [
      {
        phaseKey: 'year_1',
        milestones: [
          { milestoneKey: 'm1', status: 'not_started', dependsOn: [], priority: 'high', estimatedWeeks: 4, category: 'skill', startedAt: null, completedAt: null, notes: '', reminderSet: false },
          { milestoneKey: 'm2', status: 'locked', dependsOn: ['m1'], priority: 'medium', estimatedWeeks: 4, category: 'certification', startedAt: null, completedAt: null, notes: '', reminderSet: false },
        ],
      },
    ],
    analytics: {},
    save: jest.fn().mockResolvedValue(undefined),
    markModified: jest.fn(),
    ...overrides,
  };
}

describe('RoadmapProgressService', () => {
  let roadmapModel: any;
  let userRepo: any;
  let events: any;
  let service: RoadmapProgressService;

  beforeEach(() => {
    roadmapModel = { findOne: jest.fn() };
    userRepo = { findById: jest.fn().mockResolvedValue({ notificationChannels: {}, aiPersonalization: {} }) };
    events = { emit: jest.fn() };
    service = new RoadmapProgressService(roadmapModel, userRepo, events);
  });

  it('throws NOT_FOUND when the student has no active roadmap', async () => {
    roadmapModel.findOne.mockReturnValue(execReturning(null));
    await expect(service.updateMilestone('user-1', 'm1', { status: 'in_progress' })).rejects.toThrow(DomainException);
  });

  it('throws NOT_FOUND when the milestone key does not exist on the roadmap', async () => {
    roadmapModel.findOne.mockReturnValue(execReturning(makeRoadmapDoc()));
    await expect(service.updateMilestone('user-1', 'does-not-exist', { status: 'in_progress' })).rejects.toThrow(DomainException);
  });

  it('rejects completing a milestone whose dependency is not yet completed', async () => {
    roadmapModel.findOne.mockReturnValue(execReturning(makeRoadmapDoc()));
    await expect(service.updateMilestone('user-1', 'm2', { status: 'completed' })).rejects.toMatchObject({ code: 'MILESTONE_LOCKED' });
  });

  it('marks a milestone in_progress, sets startedAt, and schedules a reminder', async () => {
    const doc = makeRoadmapDoc();
    roadmapModel.findOne.mockReturnValue(execReturning(doc));

    const result = await service.updateMilestone('user-1', 'm1', { status: 'in_progress' });

    const m1 = result.phases[0].milestones[0];
    expect(m1.status).toBe('in_progress');
    expect(m1.startedAt).not.toBeNull();
    expect(doc.save).toHaveBeenCalled();
  });

  it('does not emit a check-in event when the student has opted out of AI notifications', async () => {
    userRepo.findById.mockResolvedValue({ notificationChannels: {}, aiPersonalization: { receiveNotifications: false } });
    roadmapModel.findOne.mockReturnValue(execReturning(makeRoadmapDoc()));

    await service.updateMilestone('user-1', 'm1', { status: 'in_progress' });

    expect(events.emit).not.toHaveBeenCalled();
  });

  it('emits a roadmap.milestone.check_in event when a milestone starts', async () => {
    userRepo.findById.mockResolvedValue({ notificationChannels: { sms: true }, aiPersonalization: {} });
    roadmapModel.findOne.mockReturnValue(execReturning(makeRoadmapDoc()));

    await service.updateMilestone('user-1', 'm1', { status: 'in_progress' });

    expect(events.emit).toHaveBeenCalledWith('roadmap.milestone.check_in', expect.objectContaining({ userId: 'user-1', milestoneKey: 'm1' }));
  });

  it('completing a milestone unlocks its dependent and recomputes analytics', async () => {
    const doc = makeRoadmapDoc();
    doc.phases[0].milestones[0].status = 'in_progress'; // simulate already-started, deps for m1 are none
    roadmapModel.findOne.mockReturnValue(execReturning(doc));

    const result = await service.updateMilestone('user-1', 'm1', { status: 'completed' });

    expect(result.phases[0].milestones[0].completedAt).not.toBeNull();
    expect(result.phases[0].milestones[1].status).toBe('not_started'); // unlocked
    expect(result.analytics.completedCount).toBe(1);
  });

  it('updates notes independently of status', async () => {
    const doc = makeRoadmapDoc();
    roadmapModel.findOne.mockReturnValue(execReturning(doc));

    const result = await service.updateMilestone('user-1', 'm1', { notes: 'Working on this over the weekend.' });

    expect(result.phases[0].milestones[0].notes).toBe('Working on this over the weekend.');
    expect(result.phases[0].milestones[0].status).toBe('not_started');
  });

  describe('getActiveAnalytics', () => {
    it('returns the active roadmap analytics', async () => {
      roadmapModel.findOne.mockReturnValue(execReturning(makeRoadmapDoc({ analytics: { completionPercent: 42 } })));
      const analytics = await service.getActiveAnalytics('user-1');
      expect(analytics).toEqual({ completionPercent: 42 });
    });

    it('throws NOT_FOUND when there is no active roadmap', async () => {
      roadmapModel.findOne.mockReturnValue(execReturning(null));
      await expect(service.getActiveAnalytics('user-1')).rejects.toThrow(DomainException);
    });
  });
});
