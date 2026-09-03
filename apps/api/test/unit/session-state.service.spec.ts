import { SessionStateService } from '../../src/modules/memory/services/session-state.service';

describe('SessionStateService', () => {
  let model: any;
  let service: SessionStateService;

  beforeEach(() => {
    model = { findOne: jest.fn(), findOneAndUpdate: jest.fn(), deleteOne: jest.fn() };
    service = new SessionStateService(model);
  });

  describe('getState', () => {
    it('returns null when the user has no session state yet', async () => {
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      expect(await service.getState('u1')).toBeNull();
    });
  });

  describe('patchState', () => {
    it('upserts only the fields provided, skipping undefined ones', async () => {
      model.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({ userId: 'u1', theme: 'dark' }) });
      await service.patchState('u1', { theme: 'dark', language: undefined } as any);

      const [filter, update, opts] = model.findOneAndUpdate.mock.calls[0];
      expect(filter).toEqual({ userId: 'u1' });
      expect(update.$set).toEqual({ theme: 'dark' });
      expect(update.$set.language).toBeUndefined();
      expect(opts).toEqual({ upsert: true, new: true });
    });

    it('merges filters/sort/pagination bags as opaque objects', async () => {
      model.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
      await service.patchState('u1', { openFilters: { colleges: { city: 'Bangalore' } } } as any);
      const [, update] = model.findOneAndUpdate.mock.calls[0];
      expect(update.$set.openFilters).toEqual({ colleges: { city: 'Bangalore' } });
    });
  });

  describe('clear', () => {
    it('deletes the session-state doc for the user', async () => {
      model.deleteOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) });
      await service.clear('u1');
      expect(model.deleteOne).toHaveBeenCalledWith({ userId: 'u1' });
    });
  });
});
