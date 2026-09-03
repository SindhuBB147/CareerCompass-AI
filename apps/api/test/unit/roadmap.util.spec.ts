import {
  autoCompleteFromProfile, applyDependencyLocks, computeAnalytics, MilestoneInstanceLike, PhaseInstanceLike,
} from '../../src/modules/roadmap/utils/roadmap.util';

function makeMilestone(overrides: Partial<MilestoneInstanceLike> = {}): MilestoneInstanceLike {
  return {
    milestoneKey: 'phase.milestone', category: 'skill', skills: [], status: 'not_started',
    startedAt: null, completedAt: null, notes: '', autoCompletedFromProfile: false, dependsOn: [],
    priority: 'medium', estimatedWeeks: 4,
    ...overrides,
  };
}

describe('roadmap.util', () => {
  describe('autoCompleteFromProfile', () => {
    it('marks a skill milestone completed when at least half its skills are already known', () => {
      const phases: PhaseInstanceLike[] = [{
        phaseKey: 'year_1',
        milestones: [makeMilestone({ milestoneKey: 'm1', category: 'skill', skills: ['Python', 'Data Structures'] })],
      }];
      autoCompleteFromProfile(phases, ['Python']);
      expect(phases[0].milestones[0].status).toBe('completed');
      expect(phases[0].milestones[0].autoCompletedFromProfile).toBe(true);
    });

    it('leaves a milestone untouched when fewer than half its skills match', () => {
      const phases: PhaseInstanceLike[] = [{
        phaseKey: 'year_1',
        milestones: [makeMilestone({ milestoneKey: 'm1', category: 'skill', skills: ['Python', 'Data Structures', 'Git', 'SQL'] })],
      }];
      autoCompleteFromProfile(phases, ['Python']);
      expect(phases[0].milestones[0].status).toBe('not_started');
    });

    it('never auto-completes project or certification milestones, even with matching skills', () => {
      const phases: PhaseInstanceLike[] = [{
        phaseKey: 'year_1',
        milestones: [
          makeMilestone({ milestoneKey: 'm1', category: 'project', skills: ['Python'] }),
          makeMilestone({ milestoneKey: 'm2', category: 'certification', skills: ['Python'] }),
        ],
      }];
      autoCompleteFromProfile(phases, ['Python']);
      expect(phases[0].milestones[0].status).toBe('not_started');
      expect(phases[0].milestones[1].status).toBe('not_started');
    });

    it('does nothing when the student has no known skills', () => {
      const phases: PhaseInstanceLike[] = [{
        phaseKey: 'year_1',
        milestones: [makeMilestone({ skills: ['Python'] })],
      }];
      autoCompleteFromProfile(phases, []);
      expect(phases[0].milestones[0].status).toBe('not_started');
    });
  });

  describe('applyDependencyLocks', () => {
    it('locks a milestone whose dependency is not yet completed', () => {
      const phases: PhaseInstanceLike[] = [{
        phaseKey: 'year_1',
        milestones: [
          makeMilestone({ milestoneKey: 'm1' }),
          makeMilestone({ milestoneKey: 'm2', dependsOn: ['m1'] }),
        ],
      }];
      applyDependencyLocks(phases);
      expect(phases[0].milestones[1].status).toBe('locked');
    });

    it('unlocks a milestone once its dependency is completed', () => {
      const phases: PhaseInstanceLike[] = [{
        phaseKey: 'year_1',
        milestones: [
          makeMilestone({ milestoneKey: 'm1', status: 'completed' }),
          makeMilestone({ milestoneKey: 'm2', dependsOn: ['m1'], status: 'locked' }),
        ],
      }];
      applyDependencyLocks(phases);
      expect(phases[0].milestones[1].status).toBe('not_started');
    });

    it('never re-locks a milestone that is already in_progress or completed', () => {
      const phases: PhaseInstanceLike[] = [{
        phaseKey: 'year_1',
        milestones: [
          makeMilestone({ milestoneKey: 'm1', status: 'not_started' }),
          makeMilestone({ milestoneKey: 'm2', dependsOn: ['m1'], status: 'in_progress' }),
        ],
      }];
      applyDependencyLocks(phases);
      expect(phases[0].milestones[1].status).toBe('in_progress');
    });

    it('leaves a milestone with no dependencies unlocked', () => {
      const phases: PhaseInstanceLike[] = [{ phaseKey: 'year_1', milestones: [makeMilestone({ milestoneKey: 'm1' })] }];
      applyDependencyLocks(phases);
      expect(phases[0].milestones[0].status).toBe('not_started');
    });
  });

  describe('computeAnalytics', () => {
    it('computes completion percent and counts from a mix of statuses', () => {
      const phases: PhaseInstanceLike[] = [{
        phaseKey: 'year_1',
        milestones: [
          makeMilestone({ milestoneKey: 'm1', status: 'completed', priority: 'high' }),
          makeMilestone({ milestoneKey: 'm2', status: 'in_progress', priority: 'medium' }),
          makeMilestone({ milestoneKey: 'm3', status: 'not_started', priority: 'low' }),
          makeMilestone({ milestoneKey: 'm4', status: 'locked', priority: 'medium' }),
        ],
      }];
      const result = computeAnalytics(phases, new Date());
      expect(result.totalCount).toBe(4);
      expect(result.completedCount).toBe(1);
      expect(result.inProgressCount).toBe(1);
      expect(result.completionPercent).toBe(25);
    });

    it('returns 0% completion and no achievements for an all-not-started roadmap', () => {
      const phases: PhaseInstanceLike[] = [{
        phaseKey: 'year_1',
        milestones: [makeMilestone({ milestoneKey: 'm1' }), makeMilestone({ milestoneKey: 'm2' })],
      }];
      const result = computeAnalytics(phases, new Date());
      expect(result.completionPercent).toBe(0);
      expect(result.achievements).toHaveLength(0);
    });

    it('awards a 25% progress achievement once a quarter of milestones are completed', () => {
      const phases: PhaseInstanceLike[] = [{
        phaseKey: 'year_1',
        milestones: [
          makeMilestone({ milestoneKey: 'm1', status: 'completed' }),
          makeMilestone({ milestoneKey: 'm2' }), makeMilestone({ milestoneKey: 'm3' }), makeMilestone({ milestoneKey: 'm4' }),
        ],
      }];
      const result = computeAnalytics(phases, new Date());
      expect(result.achievements.some(a => a.key === 'progress_25')).toBe(true);
    });

    it('flags a not-yet-due milestone as missed once its estimated window has passed', () => {
      const longAgo = new Date(Date.now() - 30 * 7 * 24 * 60 * 60 * 1000); // 30 weeks ago
      const phases: PhaseInstanceLike[] = [{
        phaseKey: 'year_1',
        milestones: [makeMilestone({ milestoneKey: 'm1', estimatedWeeks: 2, status: 'not_started' })],
      }];
      const result = computeAnalytics(phases, longAgo);
      expect(result.missedCount).toBe(1);
    });

    it('weights skillScore by priority so a completed high-priority milestone counts more than a low-priority one', () => {
      const phasesHigh: PhaseInstanceLike[] = [{
        phaseKey: 'year_1',
        milestones: [
          makeMilestone({ milestoneKey: 'm1', status: 'completed', priority: 'high' }),
          makeMilestone({ milestoneKey: 'm2', status: 'not_started', priority: 'low' }),
        ],
      }];
      const phasesLow: PhaseInstanceLike[] = [{
        phaseKey: 'year_1',
        milestones: [
          makeMilestone({ milestoneKey: 'm1', status: 'completed', priority: 'low' }),
          makeMilestone({ milestoneKey: 'm2', status: 'not_started', priority: 'high' }),
        ],
      }];
      const highResult = computeAnalytics(phasesHigh, new Date());
      const lowResult = computeAnalytics(phasesLow, new Date());
      expect(highResult.skillScore).toBeGreaterThan(lowResult.skillScore);
    });
  });
});
