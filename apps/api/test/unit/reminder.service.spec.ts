import { ReminderService } from '../../src/modules/notifications/services/reminder.service';
import { DomainException } from '../../src/common/filters/domain.exception';

function execReturning(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

describe('ReminderService', () => {
  let model: any;
  let service: ReminderService;

  beforeEach(() => {
    model = { create: jest.fn(), find: jest.fn(), updateOne: jest.fn(), sort: jest.fn() };
    service = new ReminderService(model);
  });

  it('creates a pending reminder', async () => {
    model.create.mockResolvedValue({ id: 'r1' });
    const result = await service.create({ userId: 'u1', type: 'exam', title: 'KCET registration', remindAt: new Date('2026-09-01') });
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', status: 'pending' }));
    expect(result).toEqual({ id: 'r1' });
  });

  it('lists only pending reminders for a user, soonest first', async () => {
    const sortMock = jest.fn().mockReturnValue(execReturning([{ id: 'r1' }]));
    model.find.mockReturnValue({ sort: sortMock });
    const result = await service.listForUser('u1');
    expect(model.find).toHaveBeenCalledWith({ userId: 'u1', status: 'pending' });
    expect(sortMock).toHaveBeenCalledWith({ remindAt: 1 });
    expect(result).toEqual([{ id: 'r1' }]);
  });

  describe('cancel', () => {
    it('throws NOT_FOUND when no matching reminder belongs to the user', async () => {
      model.updateOne.mockReturnValue(execReturning({ matchedCount: 0 }));
      await expect(service.cancel('u1', 'missing')).rejects.toThrow(DomainException);
    });

    it('marks the reminder cancelled when found', async () => {
      model.updateOne.mockReturnValue(execReturning({ matchedCount: 1 }));
      await expect(service.cancel('u1', 'r1')).resolves.toBeUndefined();
      expect(model.updateOne).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' }, { status: 'cancelled' });
    });
  });

  describe('findDue', () => {
    it('finds pending reminders due at or before the given time', async () => {
      const now = new Date('2026-08-11T00:00:00Z');
      model.find.mockReturnValue(execReturning([{ id: 'r1' }]));
      const result = await service.findDue(now);
      expect(model.find).toHaveBeenCalledWith({ status: 'pending', remindAt: { $lte: now } });
      expect(result).toEqual([{ id: 'r1' }]);
    });
  });

  it('markFired sets status to fired', async () => {
    model.updateOne.mockReturnValue(execReturning({}));
    await service.markFired('r1');
    expect(model.updateOne).toHaveBeenCalledWith({ _id: 'r1' }, { status: 'fired' });
  });
});
