import { NotificationSchedulerService } from '../../src/modules/notifications/services/notification-scheduler.service';
import { NOTIFICATION_EVENTS } from '../../src/modules/notifications/events/notification.events';

function execReturning(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

describe('NotificationSchedulerService', () => {
  let dispatch: any;
  let preferenceService: any;
  let reminderService: any;
  let userRepo: any;
  let events: any;
  let examModel: any;
  let scholarshipModel: any;
  let roadmapModel: any;
  let service: NotificationSchedulerService;

  beforeEach(() => {
    dispatch = { deliverDueNotifications: jest.fn().mockResolvedValue(0), dispatch: jest.fn().mockResolvedValue({ id: 'n1' }) };
    preferenceService = { getOrCreate: jest.fn() };
    reminderService = { findDue: jest.fn().mockResolvedValue([]), markFired: jest.fn().mockResolvedValue(undefined) };
    userRepo = { findByExamCode: jest.fn().mockResolvedValue([]), findById: jest.fn() };
    events = { emit: jest.fn() };
    examModel = { find: jest.fn() };
    scholarshipModel = { find: jest.fn() };
    roadmapModel = { find: jest.fn() };

    service = new NotificationSchedulerService(
      dispatch, preferenceService, reminderService, userRepo, events, examModel, scholarshipModel, roadmapModel,
    );
  });

  describe('deliverDueReminders', () => {
    it('dispatches and marks fired every due reminder', async () => {
      reminderService.findDue.mockResolvedValue([{ id: 'r1', userId: 'u1', type: 'exam', title: 'KCET round 2', note: '' }]);
      await service.deliverDueReminders();
      expect(dispatch.dispatch).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', category: 'admissions', type: 'reminder' }));
      expect(reminderService.markFired).toHaveBeenCalledWith('r1');
    });

    it('does nothing when no reminders are due', async () => {
      await service.deliverDueReminders();
      expect(dispatch.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('scanAdmissionDeadlines', () => {
    it('emits choice_filling_close exactly 3 days before the deadline', async () => {
      examModel.find.mockReturnValue(execReturning([
        { code: 'KCET', year: 2026, rounds: [{ roundNumber: 1, choiceFillingEnd: daysFromNow(3) }] },
      ]));
      await service.scanAdmissionDeadlines();
      expect(events.emit).toHaveBeenCalledWith(NOTIFICATION_EVENTS.EXAM_ROUND_UPDATED, expect.objectContaining({ examCode: 'KCET', subtype: 'choice_filling_close' }));
    });

    it('emits round_result on the day cutoffReleaseDate falls (T-0)', async () => {
      examModel.find.mockReturnValue(execReturning([
        { code: 'COMEDK', year: 2026, rounds: [{ roundNumber: 1, cutoffReleaseDate: new Date() }] },
      ]));
      await service.scanAdmissionDeadlines();
      expect(events.emit).toHaveBeenCalledWith(NOTIFICATION_EVENTS.EXAM_ROUND_UPDATED, expect.objectContaining({ examCode: 'COMEDK', subtype: 'round_result' }));
    });

    it('does not emit when no round date matches the T-0/T-3 windows', async () => {
      examModel.find.mockReturnValue(execReturning([
        { code: 'NEET', year: 2026, rounds: [{ roundNumber: 1, choiceFillingEnd: daysFromNow(10), reportingDeadline: daysFromNow(1) }] },
      ]));
      await service.scanAdmissionDeadlines();
      expect(events.emit).not.toHaveBeenCalled();
    });
  });

  describe('scanScholarshipDeadlines', () => {
    it('dispatches a deadline reminder to every student matching the scholarship exams, exactly 3 days out', async () => {
      scholarshipModel.find.mockReturnValue(execReturning([
        { id: 's1', name: 'Merit Scholarship', isActive: true, applicationDeadline: daysFromNow(3), eligibility: { exams: ['KCET'] } },
      ]));
      userRepo.findByExamCode.mockResolvedValue([{ id: 'student-1', fullName: 'Ananya' }]);

      await service.scanScholarshipDeadlines();

      expect(dispatch.dispatch).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'student-1', category: 'scholarships', relatedScholarshipId: 's1', emailTemplateKey: 'scholarship_reminder',
      }));
    });
  });

  describe('sendWeeklyRoadmapDigest', () => {
    it('skips students who have opted out of the weekly summary', async () => {
      roadmapModel.find.mockReturnValue(execReturning([
        { userId: 'u1', isActive: true, phases: [{ milestones: [{ status: 'in_progress', title: 'Learn DSA' }] }], analytics: { completionPercent: 40 } },
      ]));
      preferenceService.getOrCreate.mockResolvedValue({ weeklySummary: false });

      await service.sendWeeklyRoadmapDigest();

      expect(dispatch.dispatch).not.toHaveBeenCalled();
    });

    it('sends a digest to opted-in students with incomplete milestones', async () => {
      roadmapModel.find.mockReturnValue(execReturning([
        { userId: 'u1', isActive: true, phases: [{ milestones: [{ status: 'not_started', title: 'Learn DSA' }] }], analytics: { completionPercent: 40 } },
      ]));
      preferenceService.getOrCreate.mockResolvedValue({ weeklySummary: true });
      userRepo.findById.mockResolvedValue({ fullName: 'Ananya' });

      await service.sendWeeklyRoadmapDigest();

      expect(dispatch.dispatch).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', category: 'roadmap', emailTemplateKey: 'weekly_progress' }));
    });
  });
});
