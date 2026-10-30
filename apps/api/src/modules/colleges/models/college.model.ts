import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CollegeDocument = College & Document;

// Broad discipline classification used by the Admission Probability
// Predictor to scope course matching (e.g. KCET's "Discipline" field).
// Kept as a plain string (not a Mongoose enum) so existing course
// subdocuments without this field remain valid; predictor-side matching
// treats a missing value as 'Engineering' (see predictions/utils/course-matcher.util.ts).
export const COURSE_DISCIPLINES = [
  'Engineering', 'Architecture', 'Medical', 'Dental', 'Ayurveda', 'Unani', 'Homeopathy',
  'Naturopathy', 'Nursing', 'Pharmacy', 'Agriculture', 'Veterinary', 'AlliedHealth',
] as const;

export class CategorySeatBreakdown {
  @Prop({ type: Number, default: 0 }) cat1_g: number;
  @Prop({ type: Number, default: 0 }) cat1_r: number;
  @Prop({ type: Number, default: 0 }) cat1_k: number;
  @Prop({ type: Number, default: 0 }) cat2a_g: number;
  @Prop({ type: Number, default: 0 }) cat2a_r: number;
  @Prop({ type: Number, default: 0 }) cat2a_k: number;
  @Prop({ type: Number, default: 0 }) cat2b_g: number;
  @Prop({ type: Number, default: 0 }) cat2b_r: number;
  @Prop({ type: Number, default: 0 }) cat2b_k: number;
  @Prop({ type: Number, default: 0 }) cat3a_g: number;
  @Prop({ type: Number, default: 0 }) cat3a_r: number;
  @Prop({ type: Number, default: 0 }) cat3a_k: number;
  @Prop({ type: Number, default: 0 }) cat3b_g: number;
  @Prop({ type: Number, default: 0 }) cat3b_r: number;
  @Prop({ type: Number, default: 0 }) cat3b_k: number;
  @Prop({ type: Number, default: 0 }) st_g: number;
  @Prop({ type: Number, default: 0 }) st_r: number;
  @Prop({ type: Number, default: 0 }) st_k: number;
  @Prop({ type: Number, default: 0 }) sc_g: number;
  @Prop({ type: Number, default: 0 }) sc_r: number;
  @Prop({ type: Number, default: 0 }) sc_k: number;
  @Prop({ type: Number, default: 0 }) gm_g: number;
  @Prop({ type: Number, default: 0 }) gm_r: number;
  @Prop({ type: Number, default: 0 }) gm_k: number;
  @Prop({ type: Number, default: 0 }) total: number;
}

export class SeatMatrix {
  @Prop({ type: String, default: null }) academicYear: string | null;
  @Prop({ type: Number, default: 0 }) totalSeats: number;
  @Prop({ type: CategorySeatBreakdown, default: null }) kkSeats?: CategorySeatBreakdown | null;
  @Prop({ type: CategorySeatBreakdown, default: null }) rkSeats?: CategorySeatBreakdown | null;
  @Prop({ type: Object, default: {} }) specialQuotaSeats?: Record<string, number>;
}

export class Course {
  @Prop({ required: true }) courseId: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) degreeType: string; // B.E., B.Tech, M.Tech, MCA, MBBS, ...
  @Prop({ required: true }) durationYears: number; // e.g. 4
  @Prop({ required: true }) intake: number;
  @Prop({ type: [String], default: [] }) examsAccepted: string[];
  @Prop({ type: Number, default: null }) feePerYear: number | null;
  @Prop({ type: String, default: '' }) eligibility: string;
  @Prop({ type: Number, default: null }) cutoffRankSummary: number | null;
  @Prop({ type: String, default: 'Engineering' }) discipline: string;
  // Academic-year context for `intake`/`feePerYear` figures, and the
  // KEA/AICTE-style "sanctioned intake" figure when it differs from the
  // seats actually filled — kept optional so existing course subdocuments
  // without these fields remain valid.
  @Prop({ type: String, default: null }) academicYear: string | null;
  @Prop({ type: Number, default: null }) sanctionedIntake: number | null;
  @Prop({ type: SeatMatrix, default: null }) seatMatrix?: SeatMatrix | null;
}

export class PlacementEntry {
  @Prop({ required: true }) year: number;
  @Prop({ required: true }) highestPackage: number; // in LPA, e.g. 52
  @Prop({ required: true }) averagePackage: number; // in LPA, e.g. 12.8
  @Prop({ required: true }) medianPackage: number; // in LPA, e.g. 10.5
  @Prop({ required: true }) placementPercentage: number; // e.g. 96.4
  @Prop({ type: [String], default: [] }) topRecruiters: string[];
  @Prop({ type: Number, default: null }) studentsPlaced: number | null;
  @Prop({ type: Number, default: null }) studentsEligible: number | null;
  @Prop({ type: Number, default: null }) companiesVisited: number | null;
  @Prop({ type: Number, default: null }) internshipOpportunities: number | null;
}

// Per-quota, per-year fee figures. `tuitionFee`/`totalAnnualFee` above remain
// the general-purpose figures used by existing search/filter code; this
// sub-schema layers on the KCET/COMEDK/management-quota breakdown requested
// for the college detail page's "Seats & Fees" section.
export class FeeByQuota {
  @Prop({ type: String, default: null }) academicYear: string | null;
  @Prop({ type: Number, default: null }) kcetFee: number | null;
  @Prop({ type: Number, default: null }) comedkFee: number | null;
  @Prop({ type: Number, default: null }) managementFee: number | null;
}

export class Cutoff {
  @Prop({ required: true }) academicYear: string;
  @Prop({ required: true }) course: string;
  @Prop({ required: true }) category: string; // General, OBC, SC, ST, EWS, ...
  @Prop({ required: true }) quota: string; // KCET, COMEDK, Management
  @Prop({ default: 1 }) round: number;
  @Prop({ type: Number, default: null }) openingRank: number | null;
  @Prop({ type: Number, default: null }) closingRank: number | null;
  // Which of the college's admission codes (primary collegeId or one of
  // alternateAdmissionCodes[].code) this cutoff row applies to. Null/absent
  // means it applies to the college's primary collegeId.
  @Prop({ type: String, default: null }) admissionCode: string | null;
}

// Per-admission-code fee entry, for colleges that are also reachable under a
// second historical/alternate KCET or COMEDK code (see alternateAdmissionCodes
// on College) whose fee figures are independently sourced rather than assumed
// identical to the primary code's.
export class FeeByAdmissionCode {
  @Prop({ required: true }) admissionCode: string;
  @Prop({ type: String, default: null }) academicYear: string | null;
  @Prop({ type: Number, default: null }) kcetFee: number | null;
  @Prop({ type: Number, default: null }) comedkFee: number | null;
  @Prop({ type: Number, default: null }) managementFee: number | null;
}

export class FeeBreakdown {
  @Prop({ default: 0 }) tuitionFee: number;
  @Prop({ default: 0 }) hostelFee: number;
  @Prop({ default: 0 }) messFee: number;
  @Prop({ default: 0 }) otherCharges: number;
  @Prop({ default: 0 }) totalAnnualFee: number;
  @Prop({ type: String, default: null }) academicYear: string | null;
  @Prop({ type: FeeByQuota, default: () => ({}) }) byQuota: FeeByQuota;
  @Prop({ type: [FeeByAdmissionCode], default: [] }) byAdmissionCode: FeeByAdmissionCode[];
}

// Documents that this college is also officially reachable under a second
// admission code (a different KCET code, a COMEDK code, or a historical KCET
// code retired in favor of the current one). The college remains a single
// document; this is metadata only, not a second profile.
export class AlternateAdmissionCode {
  @Prop({ required: true }) code: string;
  @Prop({ required: true }) examBody: string; // e.g. 'KCET', 'COMEDK', 'Historical KCET Code'
  @Prop({ type: String, default: '' }) note: string;
}

export class HostelInfo {
  @Prop({ type: Boolean, default: null }) boysHostel: boolean | null;
  @Prop({ type: Boolean, default: null }) girlsHostel: boolean | null;
  @Prop({ type: Number, default: null }) capacity: number | null;
  @Prop({ type: [String], default: [] }) roomTypes: string[];
  @Prop({ type: String, default: null }) messDetails: string | null;
  @Prop({ type: [String], default: [] }) amenities: string[];
  @Prop({ type: [String], default: [] }) images: string[];
  @Prop({ type: Number, default: null }) hostelFeePerYear: number | null;
  @Prop({ type: String, default: null }) hostelFeeAcademicYear: string | null;
}

export const IMAGE_VERIFICATION_STATUSES = ['verified', 'needs_review', 'rejected'] as const;
export type ImageVerificationStatus = typeof IMAGE_VERIFICATION_STATUSES[number];

// One researched/uploaded college image. Deliberately extends the existing
// `gallery` array (rather than a new collection) with provenance + review
// metadata — a college's primary/hero image is just the gallery item with
// `isPrimary: true`, mirrored onto `College.bannerImage` for the many
// frontend surfaces that already read that field directly.
export class GalleryItem {
  @Prop({ type: String, default: () => `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` }) id: string;
  @Prop({ type: String, required: true }) category: 'Campus' | 'Library' | 'Labs' | 'Hostels' | 'Sports' | 'Auditorium' | 'Fest';
  @Prop({ required: true }) url: string;
  @Prop({ required: true }) title: string;
  // Smaller pre-sized variant for card/thumbnail contexts, when the source
  // provides one (e.g. Wikimedia Commons thumb URLs); falls back to `url`.
  @Prop({ type: String, default: null }) thumbnailUrl: string | null;
  @Prop({ type: String, default: '' }) altText: string;
  @Prop({ type: String, default: null }) sourceUrl: string | null;
  @Prop({ type: String, default: null }) sourceName: string | null;
  @Prop({ type: String, enum: IMAGE_VERIFICATION_STATUSES, default: 'needs_review' }) verificationStatus: ImageVerificationStatus;
  @Prop({ type: Boolean, default: false }) isPrimary: boolean;
  @Prop({ type: Number, default: 0 }) displayOrder: number;
  @Prop({ type: Date, default: () => new Date() }) addedAt: Date;
}

export class AdmissionStep {
  @Prop({ required: true }) stepNumber: number;
  @Prop({ required: true }) title: string;
  @Prop({ required: true }) description: string;
}

export class StudentReview {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) userName: string;
  @Prop({ default: 'Verified Student' }) userRole: string;
  @Prop({ required: true }) rating: number; // 1-5
  @Prop({ default: 4.5 }) academicsRating: number;
  @Prop({ default: 4.5 }) placementRating: number;
  @Prop({ default: 4.5 }) campusRating: number;
  @Prop({ default: 4.5 }) hostelRating: number;
  @Prop({ default: 4.5 }) facultyRating: number;
  @Prop({ required: true }) comment: string;
  @Prop({ required: true }) date: string;
  @Prop({ default: true }) verifiedStudent: boolean;
}

class Accreditation {
  @Prop({ default: 'A++' }) naac?: string;
  @Prop({ type: [String], default: ['CSE', 'ISE', 'ECE'] }) nbaCourses: string[];
  @Prop({ default: 89 }) nirfRank?: number;
}

class Contact {
  @Prop() website?: string;
  @Prop() email?: string;
  @Prop() phone?: string;
  @Prop() address?: string;
  @Prop() googleMapQuery?: string;
  @Prop() admissionPhone?: string;
  @Prop() admissionEmail?: string;
  @Prop() placementPhone?: string;
  @Prop() placementEmail?: string;
}

export class AdmissionRoute {
  @Prop({ required: true }) route: string; // KCET, COMEDK, Management
  @Prop({ type: String, default: '' }) eligibility: string;
  @Prop({ type: String, default: '' }) process: string;
}

class AboutInfo {
  @Prop({ type: String, default: '' }) summary: string;
  @Prop({ type: String, default: '' }) history: string;
  @Prop({ type: String, default: '' }) vision: string;
  @Prop({ type: String, default: '' }) mission: string;
}

class CampusInfo {
  @Prop({ type: String, default: '' }) description: string;
  @Prop({ type: [String], default: [] }) architectureHighlights: string[];
  @Prop({ type: [String], default: [] }) facilities: string[];
}

class DataMetadata {
  @Prop({ default: false }) dataVerified: boolean;
  @Prop({ type: Date, default: null }) lastVerified: Date | null;
  @Prop({ type: [String], default: [] }) dataSources: string[];
  @Prop({ type: String, default: '1.0' }) dataVersion: string;
}

export const SUPPORTED_STATES = ['Karnataka'] as const;

@Schema({ timestamps: true })
export class College {
  // Stable, human-readable identifier (E001-style) used by KEA/AICTE-style
  // references and by the frontend's [collegeId] route. `slug` remains the
  // legacy lookup key and both continue to work (see CollegeRepository.findById).
  // No `default` here: a sparse unique index only skips documents where the
  // field is *absent*, not documents where it's explicitly null, so setting
  // default: null would make every collegeId-less doc collide as duplicate
  // nulls under the unique index below.
  @Prop({ type: String }) collegeId?: string | null;
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) slug: string;
  @Prop({ type: [String], default: [] }) aliasNames: string[];
  @Prop({ type: [AlternateAdmissionCode], default: [] }) alternateAdmissionCodes: AlternateAdmissionCode[];
  @Prop({ required: true, default: 'Karnataka' }) state: string;
  @Prop({ required: true, default: 'Bengaluru' }) city: string;
  @Prop() district?: string;
  @Prop({ type: String, default: 'Government' }) collegeType: 'Government' | 'Private' | 'Autonomous' | 'Deemed';
  // No fabricated defaults below: these were previously seeded with
  // specific-looking fake values (e.g. rating: 4.8, reviewsCount: 124) for
  // ANY college document that didn't explicitly set them, which silently
  // invented data (a fake AICTE approval and a fake 4.8-star/124-review
  // rating shown on the college card/detail page) for colleges whose real
  // figures are simply not publicly known. Use null to mean "not verified".
  @Prop({ type: Number, default: null }) establishedYear: number | null;
  // AICTE only regulates technical education (engineering/architecture/
  // pharmacy/management), not medical/dental/veterinary/ayurveda/naturopathy
  // colleges also seeded here, so a blanket default of true is categorically
  // wrong for whole disciplines, not just individually unverified colleges.
  @Prop({ type: Boolean, default: null }) aicteApproved: boolean | null;
  @Prop({ type: Number, default: null }) rating: number | null;
  @Prop({ type: Number, default: null }) reviewsCount: number | null;
  @Prop({ type: Number, default: null }) campusSizeAcres: number | null;
  @Prop({ type: Number, default: null }) studentCount: number | null;
  @Prop({ type: Number, default: null }) facultyCount: number | null;
  @Prop() bannerImage: string;
  @Prop() logo: string;
  @Prop() description: string;
  @Prop({ type: [String], default: [] }) highlights: string[];
  @Prop() affiliatedUniversity?: string;
  @Prop({ type: Number, default: null }) latitude: number | null;
  @Prop({ type: Number, default: null }) longitude: number | null;

  @Prop({ type: Accreditation, default: () => ({}) }) accreditation: Accreditation;
  @Prop({ type: Contact, default: () => ({}) }) contact: Contact;
  @Prop({ type: FeeBreakdown, default: () => ({}) }) feeBreakdown: FeeBreakdown;
  @Prop({ type: HostelInfo, default: () => ({}) }) hostelInfo: HostelInfo;
  @Prop({ type: [GalleryItem], default: [] }) gallery: GalleryItem[];
  @Prop({ type: [Course], default: [] }) courses: Course[];
  @Prop({ type: [PlacementEntry], default: [] }) placementSummary: PlacementEntry[];
  @Prop({ type: [AdmissionStep], default: [] }) admissionProcess: AdmissionStep[];
  @Prop({ type: [StudentReview], default: [] }) reviewsList: StudentReview[];

  // ── Extended detail-page content (About/Campus/Admission routes/Cutoffs/Metadata) ──
  @Prop({ type: AboutInfo, default: () => ({}) }) about: AboutInfo;
  @Prop({ type: CampusInfo, default: () => ({}) }) campus: CampusInfo;
  @Prop({ type: [AdmissionRoute], default: [] }) admissionRoutes: AdmissionRoute[];
  // Per-college, per-course cutoff history shown on the detail page's "Cutoffs"
  // section. Distinct from the `cutoffs` collection (see modules/cutoffs) which
  // powers the Admission Probability Predictor across all colleges at once.
  @Prop({ type: [Cutoff], default: [] }) cutoffs: Cutoff[];
  @Prop({ type: DataMetadata, default: () => ({}) }) metadata: DataMetadata;

  @Prop({ default: true }) isVerified: boolean;
  @Prop({ type: Date, default: () => new Date() }) lastDataUpdate: Date;

  // Soft-delete: archived colleges are excluded from default search/public
  // listing but keep all attached courses/seats/cutoffs/images intact, so
  // "delete" from the admin UI never cascades into destroying related data.
  @Prop({ type: String, enum: ['active', 'archived'], default: 'active' }) status: 'active' | 'archived';
  @Prop({ type: Date, default: null }) archivedAt: Date | null;
}

export const CollegeSchema = SchemaFactory.createForClass(College);
CollegeSchema.index({ name: 'text', aliasNames: 'text', city: 'text' });
CollegeSchema.index({ slug: 1 }, { unique: true });
// Sparse: many legacy/admin-created docs still have collegeId === null, and a
// non-sparse unique index would reject every one of them after the first.
CollegeSchema.index({ collegeId: 1 }, { unique: true, sparse: true });
CollegeSchema.index({ state: 1, isVerified: 1 });
CollegeSchema.index({ 'accreditation.nirfRank': 1 });
CollegeSchema.index({ collegeType: 1 });
CollegeSchema.index({ status: 1 });
// Supports the Admission Probability Predictor's exam+discipline lookup
// (CollegeRepository.findByExamAndDiscipline) without a full collection scan.
CollegeSchema.index({ 'courses.examsAccepted': 1 });
