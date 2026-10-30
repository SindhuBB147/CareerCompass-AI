import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Scholarship, ScholarshipDocument } from '../models/scholarship.model';

export interface ScholarshipSearchFilters {
  q?: string;
  exam?: string;
  category?: string;
  provider?: string;
  reservation?: string;
  income?: number;
  status?: 'open' | 'upcoming' | 'expired' | 'all';
  sortBy?: 'deadline' | 'amount' | 'newest';
  featuredOnly?: boolean;
  isActive?: boolean;
}

const RESERVATION_FLAG_MAP: Record<string, (q: FilterQuery<ScholarshipDocument>) => void> = {
  PwD: (q) => { q['eligibility.pwdOnly'] = true; },
  Minority: (q) => { q['eligibility.minorityOnly'] = true; },
  GirlStudent: (q) => { q['eligibility.genderSpecific'] = { $regex: /^female$/i }; },
};

@Injectable()
export class ScholarshipRepository {
  constructor(@InjectModel(Scholarship.name) private readonly model: Model<ScholarshipDocument>) {}

  findById(id: string) { return this.model.findById(id).exec(); }
  findBySlug(slug: string) { return this.model.findOne({ slug }).exec(); }
  findByIds(ids: string[]) { return this.model.find({ _id: { $in: ids } }).exec(); }
  create(data: Partial<Scholarship>) { return this.model.create(data); }
  update(id: string, data: Partial<Scholarship>) {
    return this.model.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
  }

  /** Case-insensitive exact-name check — used to block duplicate scholarship records. */
  findByExactName(name: string, excludeId?: string) {
    const query: FilterQuery<ScholarshipDocument> = { name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } };
    if (excludeId) query._id = { $ne: excludeId };
    return this.model.findOne(query).exec();
  }

  /** Matches scholarships the student's profile qualifies for. Signature
   * kept stable — the Admission Predictor and AI Counsellor call this
   * indirectly via ScholarshipService.getMatched/countMatchingForProfile. */
  findMatching(filters: { category?: string; state?: string; examCodes: string[] }) {
    const query: FilterQuery<ScholarshipDocument> = {
      isActive: true,
      applicationDeadline: { $gt: new Date() },
    };
    if (filters.category) query['eligibility.categories'] = filters.category;
    if (filters.state) query['eligibility.states'] = filters.state;
    if (filters.examCodes.length > 0) query['eligibility.exams'] = { $in: filters.examCodes };
    return this.model.find(query).sort({ applicationDeadline: 1 }).exec();
  }

  listAll() { return this.model.find().sort({ applicationDeadline: 1 }).exec(); }
  listActive() { return this.model.find({ isActive: true }).exec(); }

  findFeatured(limit = 6) {
    return this.model.find({ isActive: true, featured: true, applicationDeadline: { $gt: new Date() } })
      .sort({ applicationDeadline: 1 }).limit(limit).exec();
  }

  buildSearchQuery(f: ScholarshipSearchFilters): FilterQuery<ScholarshipDocument> {
    const query: FilterQuery<ScholarshipDocument> = {};
    const andClauses: FilterQuery<ScholarshipDocument>[] = [];

    if (f.isActive !== undefined) query.isActive = f.isActive;

    if (f.q) {
      andClauses.push({
        $or: [
          { name: { $regex: f.q, $options: 'i' } },
          { description: { $regex: f.q, $options: 'i' } },
          { providerName: { $regex: f.q, $options: 'i' } },
          { categories: { $regex: f.q, $options: 'i' } },
        ],
      });
    }
    if (f.exam) {
      // A scholarship with no exam restriction (eligibility.exams: []) is
      // open to every exam's tab, not excluded from all of them.
      andClauses.push({ $or: [{ 'eligibility.exams': { $size: 0 } }, { 'eligibility.exams': f.exam.toUpperCase() }] });
    }
    if (f.category) query.categories = f.category;
    if (f.provider) query.provider = f.provider;
    if (f.income !== undefined) {
      // Scholarships with no maxIncome cap, or a cap at/above the student's income, qualify.
      andClauses.push({ $or: [{ 'eligibility.maxIncome': { $exists: false } }, { 'eligibility.maxIncome': { $gte: f.income } }] });
    }
    if (f.featuredOnly) query.featured = true;

    if (f.reservation) {
      const flagSetter = RESERVATION_FLAG_MAP[f.reservation];
      if (flagSetter) flagSetter(query);
      else query['eligibility.categories'] = f.reservation;
    }

    const now = new Date();
    if (f.status === 'open') {
      query.applicationDeadline = { $gt: now };
      andClauses.push({ $or: [{ applicationOpensAt: { $exists: false } }, { applicationOpensAt: { $lte: now } }] });
    } else if (f.status === 'upcoming') {
      query.applicationOpensAt = { $gt: now };
    } else if (f.status === 'expired') {
      query.applicationDeadline = { $lte: now };
    }

    if (andClauses.length > 0) query.$and = andClauses;
    return query;
  }

  async search(f: ScholarshipSearchFilters, page: number, limit: number) {
    const query = this.buildSearchQuery(f);
    const sort: Record<string, 1 | -1> =
      f.sortBy === 'amount' ? { 'awardAmount.value': -1 } :
      f.sortBy === 'newest' ? { createdAt: -1 } :
      { applicationDeadline: 1 };

    const [scholarships, totalResults] = await Promise.all([
      this.model.find(query).sort(sort).skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return { scholarships, totalResults };
  }

  async listPaginated(filters: { q?: string; isActive?: boolean }, page: number, limit: number) {
    const query: FilterQuery<ScholarshipDocument> = {};
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    if (filters.q) query.name = { $regex: filters.q, $options: 'i' };

    const [scholarships, totalResults] = await Promise.all([
      this.model.find(query).sort({ applicationDeadline: 1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return { scholarships, totalResults };
  }

  delete(id: string) { return this.model.findByIdAndDelete(id).exec(); }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
