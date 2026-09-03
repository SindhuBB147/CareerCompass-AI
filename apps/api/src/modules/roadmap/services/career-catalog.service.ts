import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CareerTemplate, CareerTemplateDocument } from '../models/career-template.model';
import { CAREER_TEMPLATES_SEED } from './career-templates.seed-data';
import { DomainException } from '../../../common/filters/domain.exception';

export interface CareerSummary {
  careerId: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  phaseCount: number;
  milestoneCount: number;
}

/**
 * Owns the CareerTemplate catalog — the 33 admin-managed career paths the
 * roadmap generator personalizes from. Seeds itself on first boot the same
 * way ScholarshipSeedData does for scholarships, so a fresh dev database
 * (or the in-memory Mongo used when MONGO_URI isn't set) always has a full
 * catalog to generate roadmaps against.
 */
@Injectable()
export class CareerCatalogService implements OnModuleInit {
  private readonly logger = new Logger('CareerCatalogService');

  constructor(
    @InjectModel(CareerTemplate.name) private readonly model: Model<CareerTemplateDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.model.countDocuments().exec();
    if (count > 0) return;
    await this.model.insertMany(CAREER_TEMPLATES_SEED);
    this.logger.log(`Seeded ${CAREER_TEMPLATES_SEED.length} career roadmap templates.`);
  }

  async listSummaries(category?: string): Promise<CareerSummary[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (category) filter.category = category;
    const docs = await this.model.find(filter).sort({ name: 1 }).exec();
    return docs.map(d => ({
      careerId: d.careerId,
      name: d.name,
      category: d.category,
      description: d.description,
      tags: d.tags,
      phaseCount: d.phases.length,
      milestoneCount: d.phases.reduce((sum, p) => sum + p.milestones.length, 0),
    }));
  }

  async getByCareerId(careerId: string): Promise<CareerTemplateDocument> {
    const doc = await this.model.findOne({ careerId }).exec();
    if (!doc) throw new DomainException('NOT_FOUND', `No career template found for "${careerId}".`, HttpStatus.NOT_FOUND);
    return doc;
  }

  // ── Admin CRUD ──────────────────────────────────────────────────────

  async listForAdmin(page = 1, limit = 20): Promise<{ templates: CareerTemplateDocument[]; total: number }> {
    const [templates, total] = await Promise.all([
      this.model.find().sort({ name: 1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments().exec(),
    ]);
    return { templates, total };
  }

  async create(dto: Partial<CareerTemplate>): Promise<CareerTemplateDocument> {
    const existing = await this.model.findOne({ careerId: dto.careerId }).exec();
    if (existing) throw new DomainException('CONFLICT', `A career template with id "${dto.careerId}" already exists.`, HttpStatus.CONFLICT);
    return this.model.create(dto);
  }

  async update(careerId: string, dto: Partial<CareerTemplate>): Promise<CareerTemplateDocument> {
    const doc = await this.model.findOneAndUpdate({ careerId }, { $set: dto }, { new: true }).exec();
    if (!doc) throw new DomainException('NOT_FOUND', `No career template found for "${careerId}".`, HttpStatus.NOT_FOUND);
    return doc;
  }

  async delete(careerId: string): Promise<void> {
    const result = await this.model.deleteOne({ careerId }).exec();
    if (result.deletedCount === 0) throw new DomainException('NOT_FOUND', `No career template found for "${careerId}".`, HttpStatus.NOT_FOUND);
  }
}
