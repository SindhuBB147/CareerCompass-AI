import { NotificationDispatchService } from '../../src/modules/notifications/services/notification-dispatch.service';

function execReturning(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

describe('NotificationDispatchService', () => {
  let notificationService: any;
  let preferenceService: any;
  let mailer: any;
  let userRepo: any;
  let notificationModel: any;
  let logModel: any;
  let service: NotificationDispatchService;

  const activeUser = { id: 'user-1', email: 'student@example.com', isEmailVerified: true, accountStatus: 'active' };
  const allChannelsEnabled = { channels: {}, categories: {} }; // isChannelEnabled is mocked directly below, contents unused

  beforeEach(() => {
    notificationService = { schedule: jest.fn() };
    preferenceService = { getOrCreate: jest.fn().mockResolvedValue(allChannelsEnabled), isChannelEnabled: jest.fn() };
    mailer = { deliverEmail: jest.fn().mockResolvedValue(undefined), sendTemplate: jest.fn().mockResolvedValue(undefined) };
    userRepo = { findById: jest.fn() };
    notificationModel = { find: jest.fn() };
    logModel = { create: jest.fn().mockResolvedValue(undefined) };

    service = new NotificationDispatchService(notificationService, preferenceService, mailer, userRepo, notificationModel, logModel);
  });

  describe('dispatch', () => {
    it('returns null when the user does not exist', async () => {
      userRepo.findById.mockResolvedValue(null);
      const result = await service.dispatch({ userId: 'ghost', type: 'general', category: 'system', title: 'T', message: 'M' });
      expect(result).toBeNull();
      expect(notificationService.schedule).not.toHaveBeenCalled();
    });

    it('returns null when the account is not active', async () => {
      userRepo.findById.mockResolvedValue({ ...activeUser, accountStatus: 'suspended' });
      const result = await service.dispatch({ userId: 'user-1', type: 'general', category: 'system', title: 'T', message: 'M' });
      expect(result).toBeNull();
    });

    it('returns null (and never persists) when every channel is muted for the category', async () => {
      userRepo.findById.mockResolvedValue(activeUser);
      preferenceService.isChannelEnabled.mockReturnValue(false);
      const result = await service.dispatch({ userId: 'user-1', type: 'general', category: 'system', title: 'T', message: 'M' });
      expect(result).toBeNull();
      expect(notificationService.schedule).not.toHaveBeenCalled();
    });

    it('persists the notification with only the preference-enabled channels', async () => {
      userRepo.findById.mockResolvedValue(activeUser);
      preferenceService.isChannelEnabled.mockImplementation((_pref: unknown, _cat: string, channel: string) => channel === 'inApp' || channel === 'email');
      notificationService.schedule.mockResolvedValue({ id: 'notif-1' });

      await service.dispatch({ userId: 'user-1', type: 'scholarship_new_match', category: 'scholarships', title: 'T', message: 'M' });

      expect(notificationService.schedule).toHaveBeenCalledWith(expect.objectContaining({ channels: ['inApp', 'email'] }));
    });

    it('sends a generic email when no template is specified, and logs the channel as sent', async () => {
      userRepo.findById.mockResolvedValue(activeUser);
      preferenceService.isChannelEnabled.mockImplementation((_p: unknown, _c: string, channel: string) => channel === 'email');
      notificationService.schedule.mockResolvedValue({ id: 'notif-1' });

      await service.dispatch({ userId: 'user-1', type: 'general', category: 'system', title: 'Hello', message: 'World' });

      expect(mailer.deliverEmail).toHaveBeenCalledWith('student@example.com', 'Hello', expect.stringContaining('World'));
      expect(logModel.create).toHaveBeenCalledWith(expect.objectContaining({ notificationId: 'notif-1', channel: 'email', status: 'sent' }));
    });

    it('renders via the named template when emailTemplateKey is given', async () => {
      userRepo.findById.mockResolvedValue(activeUser);
      preferenceService.isChannelEnabled.mockImplementation((_p: unknown, _c: string, channel: string) => channel === 'email');
      notificationService.schedule.mockResolvedValue({ id: 'notif-1' });

      await service.dispatch({
        userId: 'user-1', type: 'scholarship_new_match', category: 'scholarships', title: 'T', message: 'M',
        emailTemplateKey: 'scholarship_reminder', emailVariables: { name: 'Ananya' },
      });

      expect(mailer.sendTemplate).toHaveBeenCalledWith('student@example.com', 'scholarship_reminder', { name: 'Ananya' });
      expect(mailer.deliverEmail).not.toHaveBeenCalled();
    });

    it('skips email delivery (and logs why) for an unverified email address', async () => {
      userRepo.findById.mockResolvedValue({ ...activeUser, isEmailVerified: false });
      preferenceService.isChannelEnabled.mockImplementation((_p: unknown, _c: string, channel: string) => channel === 'email');
      notificationService.schedule.mockResolvedValue({ id: 'notif-1' });

      await service.dispatch({ userId: 'user-1', type: 'general', category: 'system', title: 'T', message: 'M' });

      expect(mailer.deliverEmail).not.toHaveBeenCalled();
      expect(logModel.create).toHaveBeenCalledWith(expect.objectContaining({ channel: 'email', status: 'skipped' }));
    });

    it('logs sms/whatsapp/push as skipped future-ready channels without attempting delivery', async () => {
      userRepo.findById.mockResolvedValue(activeUser);
      preferenceService.isChannelEnabled.mockImplementation((_p: unknown, _c: string, channel: string) => channel === 'sms');
      notificationService.schedule.mockResolvedValue({ id: 'notif-1' });

      await service.dispatch({ userId: 'user-1', type: 'general', category: 'system', title: 'T', message: 'M' });

      expect(logModel.create).toHaveBeenCalledWith(expect.objectContaining({ channel: 'sms', status: 'skipped', error: expect.stringContaining('future-ready') }));
    });
  });

  describe('scheduleFor', () => {
    it('persists the notification with scheduledFor but does not deliver immediately', async () => {
      userRepo.findById.mockResolvedValue(activeUser);
      preferenceService.isChannelEnabled.mockImplementation((_p: unknown, _c: string, channel: string) => channel === 'email');
      notificationService.schedule.mockResolvedValue({ id: 'notif-1' });
      const when = new Date('2026-09-01');

      await service.scheduleFor({ userId: 'user-1', type: 'roadmap_milestone', category: 'roadmap', title: 'T', message: 'M' }, when);

      expect(notificationService.schedule).toHaveBeenCalledWith(expect.objectContaining({ scheduledFor: when }));
      expect(mailer.deliverEmail).not.toHaveBeenCalled();
      expect(mailer.sendTemplate).not.toHaveBeenCalled();
    });
  });

  describe('deliverDueNotifications', () => {
    it('delivers every due pending notification and marks it sent', async () => {
      const due = {
        id: 'notif-1', userId: 'user-1', channels: ['email'], title: 'T', message: 'M',
        metadata: {}, status: 'pending', save: jest.fn().mockResolvedValue(undefined),
      };
      notificationModel.find.mockReturnValue(execReturning([due]));
      userRepo.findById.mockResolvedValue(activeUser);

      const count = await service.deliverDueNotifications(new Date('2026-08-11'));

      expect(count).toBe(1);
      expect(mailer.deliverEmail).toHaveBeenCalled();
      expect(due.status).toBe('sent');
      expect(due.save).toHaveBeenCalled();
    });

    it('marks a notification failed when its user no longer exists', async () => {
      const due = {
        id: 'notif-1', userId: 'ghost', channels: ['email'], title: 'T', message: 'M',
        metadata: {}, status: 'pending', save: jest.fn().mockResolvedValue(undefined),
      };
      notificationModel.find.mockReturnValue(execReturning([due]));
      userRepo.findById.mockResolvedValue(null);

      const count = await service.deliverDueNotifications();

      expect(count).toBe(0);
      expect(due.status).toBe('failed');
    });
  });
});
