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
}

export class PlacementEntry {
  @Prop({ required: true }) year: number;
  @Prop({ required: true }) highestPackage: number; // in LPA, e.g. 52
  @Prop({ required: true }) averagePackage: number; // in LPA, e.g. 12.8
  @Prop({ required: true }) medianPackage: number; // in LPA, e.g. 10.5
  @Prop({ required: true }) placementPercentage: number; // e.g. 96.4
  @Prop({ type: [String], default: [] }) topRecruiters: string[];
}

export class FeeBreakdown {
  @Prop({ default: 0 }) tuitionFee: number;
  @Prop({ default: 0 }) hostelFee: number;
  @Prop({ default: 0 }) messFee: number;
  @Prop({ default: 0 }) otherCharges: number;
  @Prop({ default: 0 }) totalAnnualFee: number;
}

export class HostelInfo {
  @Prop({ default: true }) boysHostel: boolean;
  @Prop({ default: true }) girlsHostel: boolean;
  @Prop({ default: 2000 }) capacity: number;
  @Prop({ type: [String], default: ['Single', 'Double Sharing', 'Triple Sharing', 'AC/Non-AC'] }) roomTypes: string[];
  @Prop({ default: 'Hygienic vegetarian and non-vegetarian mess providing 4 nutritious meals daily.' }) messDetails: string;
  @Prop({ type: [String], default: ['High-speed WiFi', 'Laundry', '24/7 Security', 'Gym', 'Sports Complex', 'Medical Room', 'Power Backup'] }) amenities: string[];
  @Prop({ type: [String], default: [] }) images: string[];
}

export class GalleryItem {
  @Prop({ required: true }) category: 'Campus' | 'Library' | 'Labs' | 'Hostels' | 'Sports' | 'Auditorium' | 'Fest';
  @Prop({ required: true }) url: string;
  @Prop({ required: true }) title: string;
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
}

export const SUPPORTED_STATES = ['Karnataka'] as const;

@Schema({ timestamps: true })
export class College {
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) slug: string;
  @Prop({ type: [String], default: [] }) aliasNames: string[];
  @Prop({ required: true, default: 'Karnataka' }) state: string;
  @Prop({ required: true, default: 'Bengaluru' }) city: string;
  @Prop() district?: string;
  @Prop({ default: 'Government' }) collegeType: 'Government' | 'Private' | 'Autonomous' | 'Deemed';
  @Prop({ default: 1963 }) establishedYear: number;
  @Prop({ default: true }) aicteApproved: boolean;
  @Prop({ default: 4.8 }) rating: number;
  @Prop({ default: 124 }) reviewsCount: number;
  @Prop({ default: 52 }) campusSizeAcres: number;
  @Prop({ default: 6500 }) studentCount: number;
  @Prop({ default: 420 }) facultyCount: number;
  @Prop() bannerImage: string;
  @Prop() logo: string;
  @Prop() description: string;
  @Prop({ type: [String], default: [] }) highlights: string[];
  @Prop() affiliatedUniversity?: string;

  @Prop({ type: Accreditation, default: () => ({}) }) accreditation: Accreditation;
  @Prop({ type: Contact, default: () => ({}) }) contact: Contact;
  @Prop({ type: FeeBreakdown, default: () => ({}) }) feeBreakdown: FeeBreakdown;
  @Prop({ type: HostelInfo, default: () => ({}) }) hostelInfo: HostelInfo;
  @Prop({ type: [GalleryItem], default: [] }) gallery: GalleryItem[];
  @Prop({ type: [Course], default: [] }) courses: Course[];
  @Prop({ type: [PlacementEntry], default: [] }) placementSummary: PlacementEntry[];
  @Prop({ type: [AdmissionStep], default: [] }) admissionProcess: AdmissionStep[];
  @Prop({ type: [StudentReview], default: [] }) reviewsList: StudentReview[];

  @Prop({ default: true }) isVerified: boolean;
  @Prop({ type: Date, default: () => new Date() }) lastDataUpdate: Date;
}

export const CollegeSchema = SchemaFactory.createForClass(College);
CollegeSchema.index({ name: 'text', aliasNames: 'text', city: 'text' });
CollegeSchema.index({ slug: 1 }, { unique: true });
CollegeSchema.index({ state: 1, isVerified: 1 });
CollegeSchema.index({ 'accreditation.nirfRank': 1 });
CollegeSchema.index({ collegeType: 1 });
// Supports the Admission Probability Predictor's exam+discipline lookup
// (CollegeRepository.findByExamAndDiscipline) without a full collection scan.
CollegeSchema.index({ 'courses.examsAccepted': 1 });
