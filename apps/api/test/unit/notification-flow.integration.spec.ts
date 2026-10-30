import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { NotificationService } from '../../src/modules/notifications/services/notification.service';
import { Notification, NotificationDocument, NotificationSchema } from '../../src/modules/notifications/models/notification.model';
import { NotificationPreferenceService } from '../../src/modules/notifications/services/notification-preference.service';
import {
  NotificationPreference, NotificationPreferenceDocument, NotificationPreferenceSchema,
} from '../../src/modules/notifications/models/notification-preference.model';

jest.setTimeout(60_000);

// End-to-end (real Mongo, no mocks) coverage of the Notification Center's
// core student-facing flow: list -> mark read -> mark all read -> archive
// -> favorite -> delete, plus the preference get/update round-trip. Mirrors
// the mongodb-memory-server pattern already used by college.repository.spec.ts.
describe('Notification Center flow (integration)', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let notificationModel: Model<NotificationDocument>;
  let preferenceModel: Model<NotificationPreferenceDocument>;
  let notificationService: NotificationService;
  let preferenceService: NotificationPreferenceService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = (await mongoose.connect(mongod.getUri())).connection;
    notificationModel = connection.model(Notification.name, NotificationSchema) as unknown as Model<NotificationDocument>;
    preferenceModel = connection.model(NotificationPreference.name, NotificationPreferenceSchema) as unknown as Model<NotificationPreferenceDocument>;
    const userRepoStub = { findByExamCode: jest.fn().mockResolvedValue([]), findById: jest.fn() } as any;
    notificationService = new NotificationService(notificationModel, userRepoStub);
    preferenceService = new NotificationPreferenceService(preferenceModel);
  });

  afterAll(async () => {
    if (connection) await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await notificationModel.deleteMany({});
    await preferenceModel.deleteMany({});
  });

  describe('list / mark-read / archive / favorite / delete', () => {
    it('walks a notification through its full lifecycle', async () => {
      const created = await notificationService.schedule({
        userId: 'student-1', type: 'scholarship_new_match', category: 'scholarships',
        title: 'New scholarship match', message: 'You are eligible for a new scholarship.', channels: ['inApp'],
      });
      expect(created.isRead).toBe(false);
      expect(created.status).toBe('sent'); // no scheduledFor -> delivered immediately

      const { notifications, total } = await notificationService.listForUser('student-1', {});
      expect(total).toBe(1);
      expect(notifications[0].id).toBe(created.id);

      expect(await notificationService.unreadCount('student-1')).toBe(1);

      const read = await notificationService.markRead('student-1', created.id);
      expect(read.isRead).toBe(true);
      expect(read.readAt).toBeTruthy();
      expect(await notificationService.unreadCount('student-1')).toBe(0);

      const favorited = await notificationService.setFavorite('student-1', created.id, true);
      expect(favorited.isFavorite).toBe(true);

      const archived = await notificationService.setArchived('student-1', created.id, true);
      expect(archived.isArchived).toBe(true);

      // Default list excludes archived notifications.
      const defaultList = await notificationService.listForUser('student-1', {});
      expect(defaultList.total).toBe(0);
      const archivedList = await notificationService.listForUser('student-1', { isArchived: true });
      expect(archivedList.total).toBe(1);

      await notificationService.remove('student-1', created.id);
      expect((await notificationService.listForUser('student-1', { isArchived: true })).total).toBe(0);
    });

    it('markAllRead flips every unread notification for that user only', async () => {
      await notificationService.schedule({ userId: 'student-1', type: 'general', category: 'system', title: 'A', message: 'A', channels: ['inApp'] });
      await notificationService.schedule({ userId: 'student-1', type: 'general', category: 'system', title: 'B', message: 'B', channels: ['inApp'] });
      await notificationService.schedule({ userId: 'student-2', type: 'general', category: 'system', title: 'C', message: 'C', channels: ['inApp'] });

      const updated = await notificationService.markAllRead('student-1');

      expect(updated).toBe(2);
      expect(await notificationService.unreadCount('student-1')).toBe(0);
      expect(await notificationService.unreadCount('student-2')).toBe(1);
    });

    it('a scheduled (future) notification starts pending, not sent', async () => {
      const future = new Date(Date.now() + 60_000);
      const notif = await notificationService.schedule({
        userId: 'student-1', type: 'roadmap_milestone', category: 'roadmap', title: 'Check in', message: 'M', channels: ['email'], scheduledFor: future,
      });
      expect(notif.status).toBe('pending');
      expect(notif.sentAt).toBeUndefined();
    });

    it('rejects marking a notification read for a user who does not own it', async () => {
      const created = await notificationService.schedule({ userId: 'student-1', type: 'general', category: 'system', title: 'A', message: 'A', channels: ['inApp'] });
      await expect(notificationService.markRead('someone-else', created.id)).rejects.toThrow();
    });
  });

  describe('preferences', () => {
    it('creates schema-default preferences on first access', async () => {
      const pref = await preferenceService.getOrCreate('student-1');
      expect(pref.channels.inApp).toBe(true);
      expect(pref.channels.browser).toBe(false);
      expect(pref.categories.admissions).toBe(true);
      expect(pref.weeklySummary).toBe(true);
      expect(pref.marketingEmails).toBe(false);
    });

    it('persists a partial update without resetting untouched fields', async () => {
      await preferenceService.getOrCreate('student-1');
      await preferenceService.update('student-1', { channels: { browser: true }, categories: { announcements: false } });

      const reloaded = await preferenceService.getOrCreate('student-1');
      expect(reloaded.channels.browser).toBe(true);
      expect(reloaded.channels.email).toBe(true); // untouched, still default
      expect(reloaded.categories.announcements).toBe(false);
      expect(reloaded.categories.admissions).toBe(true); // untouched, still default
    });

    it('isChannelEnabled reflects the persisted category/channel intersection', async () => {
      await preferenceService.update('student-1', { categories: { financial: false } });
      const pref = await preferenceService.getOrCreate('student-1');
      expect(preferenceService.isChannelEnabled(pref, 'financial', 'email')).toBe(false);
      expect(preferenceService.isChannelEnabled(pref, 'admissions', 'email')).toBe(true);
    });
  });
});
