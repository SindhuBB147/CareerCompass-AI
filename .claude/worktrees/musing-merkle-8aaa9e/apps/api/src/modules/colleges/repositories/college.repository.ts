import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { College, CollegeDocument, Course, PlacementEntry, StudentReview } from '../models/college.model';
import { AuditLog, AuditLogDocument } from '../models/audit-log.model';

export interface CollegeSearchFilters {
  q?: string;
  state?: string;
  city?: string;
  district?: string;
  collegeType?: string;
  branch?: string;
  discipline?: string;
  examCode?: string;
  minFee?: number;
  maxFee?: number;
  maxNirf?: number;
  naac?: string;
  nbaOnly?: boolean;
  aicteApproved?: boolean;
  hostelAvailable?: boolean;
  sortBy?: 'nirf' | 'fees' | 'placement' | 'name' | 'rating';
  sortOrder?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export interface CollegeFacets {
  cities: string[];
  districts: string[];
  collegeTypes: string[];
  naacGrades: string[];
  branches: string[];
  disciplines: string[];
}

@Injectable()
export class CollegeRepository {
  constructor(
    @InjectModel(College.name) private readonly model: Model<CollegeDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async search(f: CollegeSearchFilters) {
    const q: FilterQuery<CollegeDocument> = {};
    if (f.q) {
      q.$or = [
        { name: { $regex: f.q, $options: 'i' } },
        { city: { $regex: f.q, $options: 'i' } },
        { aliasNames: { $regex: f.q, $options: 'i' } },
      ];
    }
    if (f.state) q.state = { $regex: new RegExp(`^${f.state}$`, 'i') };
    if (f.city) q.city = { $regex: new RegExp(`^${f.city}$`, 'i') };
    if (f.district) q.district = { $regex: new RegExp(`^${f.district}$`, 'i') };
    if (f.collegeType) {
      // Accepts a single value ("Private") or a comma-separated list ("Government,Autonomous")
      // so the frontend can render college type as a checkbox group, not just a single select.
      const types = f.collegeType.split(',').map(t => t.trim()).filter(Boolean);
      q.collegeType = types.length > 1
        ? { $in: types.map(t => new RegExp(`^${t}$`, 'i')) }
        : { $regex: new RegExp(`^${types[0]}$`, 'i') };
    }
    if (f.branch) q['courses.name'] = { $regex: f.branch, $options: 'i' };
    if (f.discipline) {
      if (f.discipline.toLowerCase() === 'engineering') {
        // Course.discipline defaults to 'Engineering' in the schema, but
        // several seeded engineering courses were inserted without the
        // field set at all — course-matcher.util.ts (Admission Predictor)
        // already treats a missing discipline as Engineering for the same
        // reason; mirror that here so an explicit "Engineering" filter
        // doesn't silently exclude those courses. Mongo's `field: null`
        // query matches both explicitly-null and missing-field documents.
        q.$and = (q.$and ?? []).concat([
          { $or: [{ 'courses.discipline': { $regex: /^engineering$/i } }, { 'courses.discipline': null }] },
        ]);
      } else {
        q['courses.discipline'] = { $regex: new RegExp(`^${f.discipline}$`, 'i') };
      }
    }
    if (f.examCode) q['courses.examsAccepted'] = f.examCode.toUpperCase();
    if (f.minFee !== undefined || f.maxFee !== undefined) {
      q['feeBreakdown.totalAnnualFee'] = {};
      if (f.minFee !== undefined) q['feeBreakdown.totalAnnualFee'].$gte = f.minFee;
      if (f.maxFee !== undefined) q['feeBreakdown.totalAnnualFee'].$lte = f.maxFee;
    }
    if (f.maxNirf !== undefined) q['accreditation.nirfRank'] = { $lte: f.maxNirf };
    if (f.naac) q['accreditation.naac'] = { $regex: new RegExp(`^${f.naac}$`, 'i') };
    if (f.nbaOnly) q['accreditation.nbaCourses.0'] = { $exists: true };
    if (f.aicteApproved !== undefined) q.aicteApproved = f.aicteApproved;
    if (f.hostelAvailable) {
      q.$and = (q.$and ?? []).concat([
        { $or: [{ 'hostelInfo.boysHostel': true }, { 'hostelInfo.girlsHostel': true }] },
      ]);
    }

    const sort: Record<string, 1 | -1> = {};
    const order = f.sortOrder === 'desc' ? -1 : 1;
    if (f.sortBy === 'nirf') sort['accreditation.nirfRank'] = 1;
    else if (f.sortBy === 'fees') sort['feeBreakdown.totalAnnualFee'] = order;
    else if (f.sortBy === 'placement') sort['placementSummary.0.medianPackage'] = -1;
    else if (f.sortBy === 'rating') sort.rating = -1;
    else sort.name = 1;

    const skip = (f.page - 1) * f.limit;
    const [results, totalResults] = await Promise.all([
      this.model.find(q).sort(sort).skip(skip).limit(f.limit).exec(),
      this.model.countDocuments(q).exec(),
    ]);
    return { results, totalResults };
  }

  /**
   * Distinct filter-option values for the college directory's filter panel,
   * scoped to `examCode` when given (e.g. NEET should only ever offer
   * Medical/Dental/AYUSH branches, not "Computer Science"). Powers the
   * "filters change with the selected exam" UI requirement without
   * hardcoding option lists client-side that would drift from real data.
   */
  async getFacets(examCode?: string): Promise<CollegeFacets> {
    const match: FilterQuery<CollegeDocument> = examCode
      ? { 'courses.examsAccepted': examCode.toUpperCase() }
      : {};

    const courseMatch: Record<string, unknown> = examCode ? { 'courses.examsAccepted': examCode.toUpperCase() } : {};

    const [cities, districts, collegeTypes, naacGrades, courseFacets] = await Promise.all([
      this.model.distinct('city', match).exec(),
      this.model.distinct('district', { ...match, district: { $ne: null } }).exec(),
      this.model.distinct('collegeType', match).exec(),
      this.model.distinct('accreditation.naac', { ...match, 'accreditation.naac': { $ne: null } }).exec(),
      this.model.aggregate([
        { $match: match },
        { $unwind: '$courses' },
        ...(Object.keys(courseMatch).length ? [{ $match: courseMatch }] : []),
        { $group: { _id: null, branches: { $addToSet: '$courses.name' }, disciplines: { $addToSet: '$courses.discipline' } } },
      ]).exec(),
    ]);

    return {
      cities: (cities as unknown as string[]).sort(),
      districts: (districts as unknown as string[]).sort(),
      collegeTypes: (collegeTypes as unknown as string[]).sort(),
      naacGrades: (naacGrades as unknown as string[]).sort(),
      branches: ((courseFacets[0]?.branches ?? []) as string[]).sort(),
      disciplines: ((courseFacets[0]?.disciplines ?? []) as string[]).filter(Boolean).sort(),
    };
  }

  /**
   * Broad exam-scoped fetch for the Admission Probability Predictor —
   * returns every verified college with at least one course accepting
   * `examCode`. Course-name/discipline matching happens in the service
   * layer (see predictions/utils/course-matcher.util.ts): the Karnataka
   * college dataset is small enough (dozens of docs) that an in-memory
   * filter after this indexed find is simpler and just as fast as a
   * `$unwind` aggregation, and easier to keep readable.
   */
  findByExamAndDiscipline(examCode: string) {
    return this.model.find({ isVerified: true, 'courses.examsAccepted': examCode.toUpperCase() }).exec();
  }

  async findById(id: string) {
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      return this.model.findById(id).exec();
    }
    return this.model.findOne({ slug: id.toLowerCase() }).exec();
  }

  findBySlug(slug: string) {
    return this.model.findOne({ slug: slug.toLowerCase() }).exec();
  }

  findByIds(ids: string[]) {
    return this.model.find({ $or: [{ _id: { $in: ids.filter(i => i.match(/^[0-9a-fA-F]{24}$/)) } }, { slug: { $in: ids } }] }).exec();
  }

  findByNameAndState(name: string, state: string) {
    return this.model.findOne({ name, state }).exec();
  }

  create(fields: Partial<College>) {
    const slug = fields.slug || fields.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `college-${Date.now()}`;
    return this.model.create({ ...fields, slug, isVerified: true });
  }

  update(id: string, fields: Partial<College>) {
    return this.model.findByIdAndUpdate(id, { $set: fields }, { new: true }).exec();
  }

  delete(id: string) {
    return this.model.findByIdAndDelete(id).exec();
  }

  exists(id: string) {
    return this.model.exists({ _id: id });
  }

  addReview(collegeId: string, review: StudentReview) {
    return this.model.findByIdAndUpdate(
      collegeId,
      {
        $push: { reviewsList: review },
        $inc: { reviewsCount: 1 },
      },
      { new: true }
    ).exec();
  }

  // Course operations
  addCourseIfNotExists(id: string, course: Course) {
    return this.model.findOneAndUpdate(
      { _id: id, 'courses.courseId': { $ne: course.courseId } },
      { $push: { courses: course } }, { new: true },
    ).exec();
  }

  findCourse(collegeId: string, courseId: string) {
    return this.model.findOne(
      { _id: collegeId, 'courses.courseId': courseId }, { 'courses.$': 1 },
    ).exec();
  }

  updateCourse(collegeId: string, courseId: string, patch: Partial<Course>) {
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) set[`courses.$.${k}`] = v;
    return this.model.findOneAndUpdate(
      { _id: collegeId, 'courses.courseId': courseId },
      { $set: set }, { new: true },
    ).exec();
  }

  removeCourse(collegeId: string, courseId: string) {
    return this.model.findByIdAndUpdate(collegeId, { $pull: { courses: { courseId } } }, { new: true }).exec();
  }

  updateCourseFee(collegeId: string, courseId: string, feePerYear: number) {
    return this.model.findOneAndUpdate(
      { _id: collegeId, 'courses.courseId': courseId },
      { $set: { 'courses.$.feePerYear': feePerYear } },
      { new: true },
    ).exec();
  }

  // Placement operations
  addPlacementIfNotExists(id: string, entry: PlacementEntry) {
    return this.model.findOneAndUpdate(
      { _id: id, 'placementSummary.year': { $ne: entry.year } },
      { $push: { placementSummary: entry } }, { new: true },
    ).exec();
  }

  findPlacementByYear(collegeId: string, year: number) {
    return this.model.findOne(
      { _id: collegeId, 'placementSummary.year': year }, { 'placementSummary.$': 1 },
    ).exec();
  }

  updatePlacement(collegeId: string, year: number, patch: Partial<PlacementEntry>) {
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) set[`placementSummary.$.${k}`] = v;
    return this.model.findOneAndUpdate(
      { _id: collegeId, 'placementSummary.year': year },
      { $set: set }, { new: true },
    ).exec();
  }

  async recordAudit(entry: Partial<AuditLog>): Promise<void> {
    await this.auditModel.create({ ...entry, beforeSnapshot: entry.beforeSnapshot ?? null, afterSnapshot: entry.afterSnapshot ?? null, ipAddress: entry.ipAddress ?? null, timestamp: new Date() });
  }

  getAuditLogs(filters?: { adminId?: string; targetId?: string }) {
    return this.auditModel.find(filters ?? {}).sort({ timestamp: -1 }).exec();
  }
}
