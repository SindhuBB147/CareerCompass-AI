import { ConsentService } from '../../src/modules/memory/services/consent.service';

function makeModel() {
  return {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
}

describe('ConsentService', () => {
  let model: any;
  let service: ConsentService;

  beforeEach(() => {
    model = makeModel();
    service = new ConsentService(model);
  });

  describe('getConsent', () => {
    it('returns the existing record without creating a new one', async () => {
      const existing = { userId: 'u1', necessary: true };
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });
      const result = await service.getConsent('u1');
      expect(result).toBe(existing);
      expect(model.create).not.toHaveBeenCalled();
    });

    it('creates a default record (necessary only) on first access', async () => {
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      const created = { userId: 'u1', necessary: true, functional: false };
      model.create.mockResolvedValue(created);
      const result = await service.getConsent('u1');
      expect(model.create).toHaveBeenCalledWith({ userId: 'u1' });
      expect(result).toBe(created);
    });
  });

  describe('updateConsent', () => {
    it('accept_all turns every optional category on and keeps necessary true', async () => {
      model.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({ userId: 'u1' }) });
      await service.updateConsent('u1', { action: 'accept_all' } as any, { ip: '1.2.3.4', userAgent: 'jest' });

      const [filter, update] = model.findOneAndUpdate.mock.calls[0];
      expect(filter).toEqual({ userId: 'u1' });
      expect(update.$set).toEqual(expect.objectContaining({
        necessary: true, functional: true, analytics: true, preference: true, aiPersonalization: true,
      }));
      expect(update.$push.history.$each[0]).toEqual(expect.objectContaining({ action: 'accept_all', ip: '1.2.3.4' }));
    });

    it('reject_optional turns every optional category off', async () => {
      model.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({ userId: 'u1' }) });
      await service.updateConsent('u1', { action: 'reject_optional' } as any, {});

      const [, update] = model.findOneAndUpdate.mock.calls[0];
      expect(update.$set).toEqual(expect.objectContaining({
        functional: false, analytics: false, preference: false, aiPersonalization: false,
      }));
    });

    it('customize only changes the categories explicitly provided', async () => {
      model.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({ userId: 'u1' }) });
      await service.updateConsent('u1', { action: 'customize', analytics: true } as any, {});

      const [, update] = model.findOneAndUpdate.mock.calls[0];
      expect(update.$set.analytics).toBe(true);
      expect(update.$set.functional).toBeUndefined();
      expect(update.$set.preference).toBeUndefined();
    });

    it('caps history to the last 50 entries via $slice', async () => {
      model.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({ userId: 'u1' }) });
      await service.updateConsent('u1', { action: 'accept_all' } as any, {});
      const [, update] = model.findOneAndUpdate.mock.calls[0];
      expect(update.$push.history.$slice).toBe(-50);
    });
  });

  describe('withdraw', () => {
    it('turns off every optional category and logs a withdraw action', async () => {
      model.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({ userId: 'u1' }) });
      await service.withdraw('u1', { ip: '9.9.9.9' });

      const [, update] = model.findOneAndUpdate.mock.calls[0];
      expect(update.$set).toEqual(expect.objectContaining({
        functional: false, analytics: false, preference: false, aiPersonalization: false,
      }));
      expect(update.$push.history.$each[0].action).toBe('withdraw');
    });
  });
});
