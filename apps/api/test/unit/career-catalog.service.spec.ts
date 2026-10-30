import { CareerCatalogService } from '../../src/modules/roadmap/services/career-catalog.service';
import { CAREER_TEMPLATES_SEED } from '../../src/modules/roadmap/services/career-templates.seed-data';
import { DomainException } from '../../src/common/filters/domain.exception';

function execReturning(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

describe('CareerCatalogService', () => {
  let model: any;
  let service: CareerCatalogService;

  beforeEach(() => {
    model = {
      countDocuments: jest.fn(),
      insertMany: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      create: jest.fn(),
    };
    service = new CareerCatalogService(model);
  });

  describe('onModuleInit', () => {
    it('seeds all career templates on an empty collection', async () => {
      model.countDocuments.mockReturnValue(execReturning(0));
      await service.onModuleInit();
      expect(model.insertMany).toHaveBeenCalledWith(CAREER_TEMPLATES_SEED);
    });

    it('does not reseed when templates already exist', async () => {
      model.countDocuments.mockReturnValue(execReturning(33));
      await service.onModuleInit();
      expect(model.insertMany).not.toHaveBeenCalled();
    });
  });

  it('seed data contains exactly 33 unique career ids, each with 6 phases', () => {
    const ids = CAREER_TEMPLATES_SEED.map(t => t.careerId);
    expect(ids).toHaveLength(33);
    expect(new Set(ids).size).toBe(33);
    for (const t of CAREER_TEMPLATES_SEED) {
      expect(t.phases).toHaveLength(6);
      expect(t.phases.every(p => p.milestones.length > 0)).toBe(true);
    }
  });

  describe('getByCareerId', () => {
    it('throws NOT_FOUND for an unknown career id', async () => {
      model.findOne.mockReturnValue(execReturning(null));
      await expect(service.getByCareerId('not-a-career')).rejects.toThrow(DomainException);
    });

    it('returns the matching template', async () => {
      const doc = { careerId: 'software-engineer' };
      model.findOne.mockReturnValue(execReturning(doc));
      expect(await service.getByCareerId('software-engineer')).toBe(doc);
    });
  });

  describe('create', () => {
    it('rejects a duplicate careerId', async () => {
      model.findOne.mockReturnValue(execReturning({ careerId: 'software-engineer' }));
      await expect(service.create({ careerId: 'software-engineer' } as any)).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(model.create).not.toHaveBeenCalled();
    });

    it('creates a new template when the careerId is free', async () => {
      model.findOne.mockReturnValue(execReturning(null));
      model.create.mockResolvedValue({ careerId: 'new-career' });
      const result = await service.create({ careerId: 'new-career', name: 'New Career' } as any);
      expect(result).toEqual({ careerId: 'new-career' });
    });
  });

  describe('delete', () => {
    it('throws NOT_FOUND when nothing was deleted', async () => {
      model.deleteOne.mockReturnValue(execReturning({ deletedCount: 0 }));
      await expect(service.delete('missing')).rejects.toThrow(DomainException);
    });

    it('resolves when a template is deleted', async () => {
      model.deleteOne.mockReturnValue(execReturning({ deletedCount: 1 }));
      await expect(service.delete('software-engineer')).resolves.toBeUndefined();
    });
  });
});
