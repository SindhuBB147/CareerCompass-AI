import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { College, CollegeDocument, Course, GalleryItem, PlacementEntry, StudentReview } from '../models/college.model';
import { AuditLog, AuditLogDocument } from '../models/audit-log.model';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface CollegeSearchFilters {
  includeArchived?: boolean;
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
    if (!f.includeArchived) q.status = { $ne: 'archived' };
    const query = f.q?.trim();
    if (query) {
      const term = new RegExp(escapeRegExp(query), 'i');
      q.$or = [
        { name: term },
        { aliasNames: term },
        { city: term },
        { district: term },
        { state: term },
        { collegeId: term },
        { collegeType: term },
        { 'courses.name': term },
        { 'courses.discipline': term },
      ];
    }
    if (f.state?.trim()) q.state = { $regex: new RegExp(`^${escapeRegExp(f.state.trim())}$`, 'i') };
    if (f.city?.trim()) q.city = new RegExp(escapeRegExp(f.city.trim()), 'i');
    if (f.district?.trim()) {
      const district = new RegExp(escapeRegExp(f.district.trim()), 'i');
      q.$and = (q.$and ?? []).concat([
        { $or: [{ district }, { district: { $in: [null, ''] }, city: district }] },
      ]);
    }
    if (f.collegeType) {
      const types = f.collegeType.split(',').map(t => t.trim()).filter(Boolean);
      q.collegeType = types.length > 1
        ? { $in: types.map(t => new RegExp(`^${escapeRegExp(t)}$`, 'i')) }
        : { $regex: new RegExp(`^${escapeRegExp(types[0] ?? '')}$`, 'i') };
    }
    if (f.branch?.trim()) q['courses.name'] = new RegExp(escapeRegExp(f.branch.trim()), 'i');
    if (f.discipline) {
      if (f.discipline.toLowerCase() === 'engineering') {
        q.$and = (q.$and ?? []).concat([
          { $or: [{ 'courses.discipline': { $regex: /^engineering$/i } }, { 'courses.discipline': null }] },
        ]);
      } else {
        q['courses.discipline'] = { $regex: new RegExp(`^${escapeRegExp(f.discipline)}$`, 'i') };
      }
    }
    if (f.examCode) q['courses.examsAccepted'] = f.examCode.toUpperCase();
    if (f.minFee !== undefined || f.maxFee !== undefined) {
      q['feeBreakdown.totalAnnualFee'] = {};
      if (f.minFee !== undefined) q['feeBreakdown.totalAnnualFee'].$gte = f.minFee;
      if (f.maxFee !== undefined) q['feeBreakdown.totalAnnualFee'].$lte = f.maxFee;
    }
    if (f.maxNirf !== undefined) q['accreditation.nirfRank'] = { $lte: f.maxNirf };
    if (f.naac) q['accreditation.naac'] = { $regex: new RegExp(`^${escapeRegExp(f.naac)}$`, 'i') };
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

  async getFacets(examCode?: string): Promise<CollegeFacets> {
    const match: FilterQuery<CollegeDocument> = examCode ? { 'courses.examsAccepted': examCode.toUpperCase() } : {};
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

  findByExamAndDiscipline(examCode: string) {
    return this.model.find({ isVerified: true, 'courses.examsAccepted': examCode.toUpperCase() }).exec();
  }

  async findById(id: string) {
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      return this.model.findById(id).exec();
    }
    if (id.match(/^[A-Z]\d{3,}$/i)) {
      const upper = id.toUpperCase();
      const byCollegeId = await this.model.findOne({ collegeId: upper }).exec();
      if (byCollegeId) return byCollegeId;
      const byAltCode = await this.model.findOne({ 'alternateAdmissionCodes.code': upper }).exec();
      if (byAltCode) return byAltCode;
    }
    return this.model.findOne({ slug: id.toLowerCase() }).exec();
  }

  findBySlug(slug: string) {
    return this.model.findOne({ slug: slug.toLowerCase() }).exec();
  }

  findByIds(ids: string[]) {
    const codeIds = ids.filter(i => i.match(/^[A-Z]\d{3,}$/i)).map(i => i.toUpperCase());
    const objectIdStrings = ids.filter(i => i.match(/^[0-9a-fA-F]{24}$/));
    const objectIds = objectIdStrings.map(i => new Types.ObjectId(i));
    return this.model.find({
      $or: [
        { _id: { $in: objectIds } },
        ...(codeIds.length ? [{ collegeId: { $in: codeIds } }, { 'alternateAdmissionCodes.code': { $in: codeIds } }] : []),
        { slug: { $in: ids } },
      ],
    }).exec();
  }

  findByNameAndState(name: string, state: string) {
    return this.model.findOne({ name, state }).exec();
  }

  findByCollegeId(collegeId: string) {
    return this.model.findOne({ collegeId: collegeId.toUpperCase() }).exec();
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

  archive(id: string) {
    return this.model.findByIdAndUpdate(id, { $set: { status: 'archived', archivedAt: new Date() } }, { new: true }).exec();
  }

  restore(id: string) {
    return this.model.findByIdAndUpdate(id, { $set: { status: 'active', archivedAt: null } }, { new: true }).exec();
  }

  exists(id: string) {
    return this.model.exists({ _id: id });
  }

  addReview(collegeId: string, review: StudentReview) {
    return this.model.findByIdAndUpdate(
      collegeId,
      { $push: { reviewsList: review }, $inc: { reviewsCount: 1 } },
      { new: true }
    ).exec();
  }

  addCourseIfNotExists(id: string, course: Course) {
    return this.model.findOneAndUpdate(
      { _id: id, 'courses.courseId': { $ne: course.courseId } },
      { $push: { courses: course } }, { new: true },
    ).exec();
  }

  findCourse(collegeId: string, courseId: string) {
    return this.model.findOne({ _id: collegeId, 'courses.courseId': courseId }, { 'courses.$': 1 }).exec();
  }

  updateCourse(collegeId: string, courseId: string, patch: Partial<Course>) {
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) set[`courses.$.${k}`] = v;
    return this.model.findOneAndUpdate({ _id: collegeId, 'courses.courseId': courseId }, { $set: set }, { new: true }).exec();
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

  updateSeatMatrix(collegeId: string, courseId: string, seatMatrix: unknown) {
    return this.model.findOneAndUpdate(
      { _id: collegeId, 'courses.courseId': courseId },
      { $set: { 'courses.$.seatMatrix': seatMatrix } },
      { new: true },
    ).exec();
  }

  addPlacementIfNotExists(id: string, entry: PlacementEntry) {
    return this.model.findOneAndUpdate(
      { _id: id, 'placementSummary.year': { $ne: entry.year } },
      { $push: { placementSummary: entry } }, { new: true },
    ).exec();
  }

  findPlacementByYear(collegeId: string, year: number) {
    return this.model.findOne({ _id: collegeId, 'placementSummary.year': year }, { 'placementSummary.$': 1 }).exec();
  }

  updatePlacement(collegeId: string, year: number, patch: Partial<PlacementEntry>) {
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) set[`placementSummary.$.${k}`] = v;
    return this.model.findOneAndUpdate({ _id: collegeId, 'placementSummary.year': year }, { $set: set }, { new: true }).exec();
  }

  addGalleryImage(collegeId: string, item: GalleryItem) {
    return this.model.findByIdAndUpdate(collegeId, { $push: { gallery: item } }, { new: true }).exec();
  }

  findGalleryImage(collegeId: string, imageId: string) {
    return this.model.findOne({ _id: collegeId, 'gallery.id': imageId }, { 'gallery.$': 1 }).exec();
  }

  updateGalleryImage(collegeId: string, imageId: string, patch: Partial<GalleryItem>) {
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) set[`gallery.$.${k}`] = v;
    return this.model.findOneAndUpdate({ _id: collegeId, 'gallery.id': imageId }, { $set: set }, { new: true }).exec();
  }

  removeGalleryImage(collegeId: string, imageId: string) {
    return this.model.findByIdAndUpdate(collegeId, { $pull: { gallery: { id: imageId } } }, { new: true }).exec();
  }

  async setPrimaryImage(collegeId: string, imageId: string, url: string) {
    await this.model.updateOne({ _id: collegeId }, { $set: { 'gallery.$[].isPrimary': false } }).exec();
    return this.model.findOneAndUpdate(
      { _id: collegeId, 'gallery.id': imageId },
      { $set: { bannerImage: url, 'gallery.$.isPrimary': true, 'gallery.$.verificationStatus': 'verified' } },
      { new: true },
    ).exec();
  }

  async reorderGallery(collegeId: string, orderedIds: string[]) {
    const ops = orderedIds.map((imageId, index) => ({
      updateOne: {
        filter: { _id: collegeId, 'gallery.id': imageId },
        update: { $set: { 'gallery.$.displayOrder': index } },
      },
    }));
    if (ops.length) await this.model.bulkWrite(ops);
    return this.model.findById(collegeId).exec();
  }

  async recordAudit(entry: Partial<AuditLog>): Promise<void> {
    await this.auditModel.create({ ...entry, beforeSnapshot: entry.beforeSnapshot ?? null, afterSnapshot: entry.afterSnapshot ?? null, ipAddress: entry.ipAddress ?? null, timestamp: new Date() });
  }

  getAuditLogs(filters?: { adminId?: string; targetId?: string }) {
    return this.auditModel.find(filters ?? {}).sort({ timestamp: -1 }).exec();
  }

  getModel(): Model<CollegeDocument> {
    return this.model;
  }
}
