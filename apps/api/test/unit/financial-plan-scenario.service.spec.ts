import { FinancialPlanScenarioService } from '../../src/modules/financial-planning/services/financial-plan-scenario.service';

describe('FinancialPlanScenarioService', () => {
  let model: any;
  let service: FinancialPlanScenarioService;

  beforeEach(() => {
    model = { create: jest.fn(), find: jest.fn(), deleteMany: jest.fn() };
    service = new FinancialPlanScenarioService(model);
  });

  describe('saveScenario', () => {
    it('persists the scenario with its input and result summary', async () => {
      model.create.mockResolvedValue({});
      await service.saveScenario('u1', 'dashboard', { collegeId: 'c1' }, { totalProgramCost: 500000 });
      expect(model.create).toHaveBeenCalledWith({
        userId: 'u1', type: 'dashboard', input: { collegeId: 'c1' }, resultSummary: { totalProgramCost: 500000 },
      });
    });

    it('swallows persistence failures — a calculation response must never break', async () => {
      model.create.mockRejectedValue(new Error('mongo down'));
      await expect(service.saveScenario('u1', 'dashboard', {}, {})).resolves.toBeUndefined();
    });
  });

  describe('listHistory', () => {
    it('sorts newest-first and caps to the default limit', async () => {
      const exec = jest.fn().mockResolvedValue([{ type: 'dashboard' }]);
      const limit = jest.fn().mockReturnValue({ exec });
      const sort = jest.fn().mockReturnValue({ limit });
      model.find.mockReturnValue({ sort });

      const result = await service.listHistory('u1');
      expect(model.find).toHaveBeenCalledWith({ userId: 'u1' });
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(limit).toHaveBeenCalledWith(20);
      expect(result).toEqual([{ type: 'dashboard' }]);
    });
  });

  describe('clear', () => {
    it('deletes every scenario for the user', async () => {
      model.deleteMany.mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 3 }) });
      await service.clear('u1');
      expect(model.deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
    });
  });
});
