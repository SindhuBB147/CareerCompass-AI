import { ScholarshipInteractionService } from '../../src/modules/scholarships/services/scholarship-interaction.service';

describe('ScholarshipInteractionService', () => {
  let model: any;
  let service: ScholarshipInteractionService;

  beforeEach(() => {
    model = { create: jest.fn(), find: jest.fn(), deleteMany: jest.fn() };
    service = new ScholarshipInteractionService(model);
  });

  describe('record', () => {
    it('persists the interaction with action and metadata', async () => {
      model.create.mockResolvedValue({});
      await service.record('u1', 's1', 'eligibility_checked', { verdict: 'eligible' });
      expect(model.create).toHaveBeenCalledWith({
        userId: 'u1', scholarshipId: 's1', action: 'eligibility_checked', metadata: { verdict: 'eligible' },
      });
    });

    it('defaults metadata to {} when omitted', async () => {
      model.create.mockResolvedValue({});
      await service.record('u1', 's1', 'viewed');
      expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }));
    });

    it('swallows persistence failures — must never break the calling feature', async () => {
      model.create.mockRejectedValue(new Error('mongo down'));
      await expect(service.record('u1', 's1', 'applied')).resolves.toBeUndefined();
    });
  });

  describe('listForUser', () => {
    it('sorts newest-first', async () => {
      const exec = jest.fn().mockResolvedValue([{ action: 'viewed' }]);
      const limit = jest.fn().mockReturnValue({ exec });
      const sort = jest.fn().mockReturnValue({ limit });
      model.find.mockReturnValue({ sort });

      const result = await service.listForUser('u1');
      expect(model.find).toHaveBeenCalledWith({ userId: 'u1' });
      expect(result).toEqual([{ action: 'viewed' }]);
    });
  });

  describe('clear', () => {
    it('deletes every interaction for the user', async () => {
      model.deleteMany.mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 2 }) });
      await service.clear('u1');
      expect(model.deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
    });
  });
});
