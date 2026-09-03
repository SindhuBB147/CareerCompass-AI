import { NotificationPreferenceService } from '../../src/modules/notifications/services/notification-preference.service';

function makePref(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    channels: { inApp: true, email: true, browser: false, sms: false, whatsapp: false, push: false },
    categories: {
      admissions: true, scholarships: true, roadmap: true, financial: true,
      ai_suggestions: true, account: true, system: true, announcements: true,
    },
    weeklySummary: true,
    marketingEmails: false,
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('NotificationPreferenceService', () => {
  let model: any;
  let service: NotificationPreferenceService;

  beforeEach(() => {
    model = { findOne: jest.fn(), create: jest.fn() };
    service = new NotificationPreferenceService(model);
  });

  describe('getOrCreate', () => {
    it('returns the existing preference doc without creating a new one', async () => {
      const existing = makePref();
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });
      const result = await service.getOrCreate('user-1');
      expect(result).toBe(existing);
      expect(model.create).not.toHaveBeenCalled();
    });

    it('creates a preference doc with full explicit defaults on first access', async () => {
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      const created = makePref();
      model.create.mockResolvedValue(created);
      const result = await service.getOrCreate('user-1');
      expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-1',
        channels: expect.objectContaining({ inApp: true, email: true, browser: false }),
        categories: expect.objectContaining({ admissions: true, announcements: true }),
      }));
      expect(result).toBe(created);
    });
  });

  describe('update', () => {
    it('merges a partial channel patch without clobbering other channels', async () => {
      const existing = makePref();
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });
      const result = await service.update('user-1', { channels: { browser: true } });
      expect(result.channels).toEqual(expect.objectContaining({ inApp: true, email: true, browser: true }));
      expect(existing.save).toHaveBeenCalled();
    });

    it('merges a partial category patch', async () => {
      const existing = makePref();
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });
      const result = await service.update('user-1', { categories: { announcements: false } });
      expect(result.categories.announcements).toBe(false);
      expect(result.categories.admissions).toBe(true);
    });

    it('updates weeklySummary and marketingEmails flags', async () => {
      const existing = makePref();
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });
      const result = await service.update('user-1', { weeklySummary: false, marketingEmails: true });
      expect(result.weeklySummary).toBe(false);
      expect(result.marketingEmails).toBe(true);
    });
  });

  describe('isChannelEnabled', () => {
    it('is true only when both the category and the channel are enabled', () => {
      const pref = makePref() as any;
      expect(service.isChannelEnabled(pref, 'admissions', 'email')).toBe(true);
      expect(service.isChannelEnabled(pref, 'admissions', 'browser')).toBe(false); // channel off
    });

    it('is false when the category is muted, even if the channel is on', () => {
      const pref = makePref({ categories: { ...makePref().categories, admissions: false } }) as any;
      expect(service.isChannelEnabled(pref, 'admissions', 'email')).toBe(false);
    });
  });
});
