import { ScholarshipTaxonomyService } from '../../src/modules/scholarships/services/scholarship-taxonomy.service';
import { ScholarshipCategoryRepository } from '../../src/modules/scholarships/repositories/scholarship-category.repository';
import { ScholarshipProviderRepository } from '../../src/modules/scholarships/repositories/scholarship-provider.repository';
import { DomainException } from '../../src/common/filters/domain.exception';

describe('ScholarshipTaxonomyService', () => {
  let categoryRepo: jest.Mocked<Pick<ScholarshipCategoryRepository, 'findBySlug' | 'create' | 'update' | 'delete' | 'countAll'>>;
  let providerRepo: jest.Mocked<Pick<ScholarshipProviderRepository, 'findByName' | 'create' | 'update' | 'delete'>>;
  let service: ScholarshipTaxonomyService;

  beforeEach(() => {
    categoryRepo = { findBySlug: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), countAll: jest.fn() };
    providerRepo = { findByName: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
    service = new ScholarshipTaxonomyService(
      categoryRepo as unknown as ScholarshipCategoryRepository,
      providerRepo as unknown as ScholarshipProviderRepository,
    );
  });

  describe('createCategory', () => {
    it('rejects a duplicate slug', async () => {
      categoryRepo.findBySlug.mockResolvedValue({ slug: 'merit' } as any);
      await expect(service.createCategory({ slug: 'merit', name: 'Merit' })).rejects.toBeInstanceOf(DomainException);
      expect(categoryRepo.create).not.toHaveBeenCalled();
    });

    it('creates a new category', async () => {
      categoryRepo.findBySlug.mockResolvedValue(null);
      categoryRepo.create.mockResolvedValue({ slug: 'merit', name: 'Merit' } as any);
      const result = await service.createCategory({ slug: 'merit', name: 'Merit' });
      expect(result.slug).toBe('merit');
    });
  });

  describe('updateCategory / deleteCategory', () => {
    it('throws NOT_FOUND updating a missing category', async () => {
      categoryRepo.update.mockResolvedValue(null);
      await expect(service.updateCategory('missing', { name: 'X' })).rejects.toBeInstanceOf(DomainException);
    });
    it('throws NOT_FOUND deleting a missing category', async () => {
      categoryRepo.delete.mockResolvedValue(null);
      await expect(service.deleteCategory('missing')).rejects.toBeInstanceOf(DomainException);
    });
  });

  describe('createProvider', () => {
    it('rejects a duplicate provider name', async () => {
      providerRepo.findByName.mockResolvedValue({ name: 'AICTE' } as any);
      await expect(service.createProvider({ name: 'AICTE', type: 'government_central' })).rejects.toBeInstanceOf(DomainException);
      expect(providerRepo.create).not.toHaveBeenCalled();
    });

    it('creates a new provider', async () => {
      providerRepo.findByName.mockResolvedValue(null);
      providerRepo.create.mockResolvedValue({ name: 'AICTE' } as any);
      const result = await service.createProvider({ name: 'AICTE', type: 'government_central' });
      expect(result.name).toBe('AICTE');
    });
  });
});
