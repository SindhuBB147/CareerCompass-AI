import { Injectable, OnModuleInit, HttpStatus } from '@nestjs/common';
import { ScholarshipCategoryRepository } from '../repositories/scholarship-category.repository';
import { ScholarshipProviderRepository } from '../repositories/scholarship-provider.repository';
import { ScholarshipCategory } from '../models/scholarship-category.model';
import { ScholarshipProvider } from '../models/scholarship-provider.model';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/category.dto';
import { CreateProviderDto, UpdateProviderDto } from '../dto/provider.dto';
import { DomainException } from '../../../common/filters/domain.exception';

const SEED_CATEGORIES: Array<Pick<ScholarshipCategory, 'slug' | 'name' | 'icon' | 'sortOrder'>> = [
  { slug: 'government-central', name: 'Central Government Scholarships', icon: '🏛️', sortOrder: 1 },
  { slug: 'government-state', name: 'State Government Scholarships', icon: '🏢', sortOrder: 2 },
  { slug: 'private', name: 'Private Scholarships', icon: '💼', sortOrder: 3 },
  { slug: 'college', name: 'College Scholarships', icon: '🎓', sortOrder: 4 },
  { slug: 'minority', name: 'Minority Scholarships', icon: '🕊️', sortOrder: 5 },
  { slug: 'sc-st', name: 'SC/ST Scholarships', icon: '✊', sortOrder: 6 },
  { slug: 'obc', name: 'OBC Scholarships', icon: '👥', sortOrder: 7 },
  { slug: 'ews', name: 'EWS Scholarships', icon: '📋', sortOrder: 8 },
  { slug: 'merit', name: 'Merit Scholarships', icon: '⭐', sortOrder: 9 },
  { slug: 'merit-cum-means', name: 'Merit-cum-Means Scholarships', icon: '📊', sortOrder: 10 },
  { slug: 'sports', name: 'Sports Scholarships', icon: '🏅', sortOrder: 11 },
  { slug: 'pwd', name: 'PwD Scholarships', icon: '♿', sortOrder: 12 },
  { slug: 'defence', name: 'Defence Scholarships', icon: '🎖️', sortOrder: 13 },
  { slug: 'girl-student', name: 'Girl Student Scholarships', icon: '👧', sortOrder: 14 },
  { slug: 'aicte', name: 'AICTE Scholarships', icon: '🏗️', sortOrder: 15 },
  { slug: 'medical', name: 'Medical Scholarships', icon: '⚕️', sortOrder: 16 },
  { slug: 'engineering', name: 'Engineering Scholarships', icon: '⚙️', sortOrder: 17 },
  { slug: 'need-based', name: 'Need-Based Scholarships', icon: '🤝', sortOrder: 18 },
  { slug: 'institutional', name: 'Institutional Scholarships', icon: '🏫', sortOrder: 19 },
  { slug: 'alumni', name: 'Alumni Scholarships', icon: '🎓', sortOrder: 20 },
  { slug: 'ngo', name: 'NGO Scholarships', icon: '🌱', sortOrder: 21 },
  { slug: 'corporate', name: 'Corporate Scholarships', icon: '🏢', sortOrder: 22 },
  { slug: 'means', name: 'Means-Based Scholarships', icon: '💰', sortOrder: 23 },
  { slug: 'disability', name: 'Disability Scholarships', icon: '♿', sortOrder: 24 },
];

@Injectable()
export class ScholarshipTaxonomyService implements OnModuleInit {
  constructor(
    private readonly categoryRepo: ScholarshipCategoryRepository,
    private readonly providerRepo: ScholarshipProviderRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const count = await this.categoryRepo.countAll();
      if (count === 0) {
        for (const cat of SEED_CATEGORIES) await this.categoryRepo.create(cat);
      }
    } catch {
      // Offline-mode tolerant, matches ScholarshipService's own seed guard.
    }
  }

  // ── Categories ───────────────────────────────────────────────────────────

  listCategories() { return this.categoryRepo.listAll(); }

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.categoryRepo.findBySlug(dto.slug);
    if (existing) throw new DomainException('CONFLICT', `Category "${dto.slug}" already exists.`, HttpStatus.CONFLICT);
    return this.categoryRepo.create(dto);
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const updated = await this.categoryRepo.update(id, dto);
    if (!updated) throw new DomainException('NOT_FOUND', 'Category not found.', HttpStatus.NOT_FOUND);
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    const deleted = await this.categoryRepo.delete(id);
    if (!deleted) throw new DomainException('NOT_FOUND', 'Category not found.', HttpStatus.NOT_FOUND);
  }

  // ── Providers ────────────────────────────────────────────────────────────

  listProviders() { return this.providerRepo.listAll(); }

  async createProvider(dto: CreateProviderDto) {
    const existing = await this.providerRepo.findByName(dto.name);
    if (existing) throw new DomainException('CONFLICT', `Provider "${dto.name}" already exists.`, HttpStatus.CONFLICT);
    return this.providerRepo.create(dto as Partial<ScholarshipProvider>);
  }

  async updateProvider(id: string, dto: UpdateProviderDto) {
    const updated = await this.providerRepo.update(id, dto as Partial<ScholarshipProvider>);
    if (!updated) throw new DomainException('NOT_FOUND', 'Provider not found.', HttpStatus.NOT_FOUND);
    return updated;
  }

  async deleteProvider(id: string): Promise<void> {
    const deleted = await this.providerRepo.delete(id);
    if (!deleted) throw new DomainException('NOT_FOUND', 'Provider not found.', HttpStatus.NOT_FOUND);
  }
}
