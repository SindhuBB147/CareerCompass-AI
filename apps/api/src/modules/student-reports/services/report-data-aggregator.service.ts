import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRepository } from '../../users/repositories/user.repository';
import { CollegeRepository } from '../../colleges/repositories/college.repository';
import { PredictionService } from '../../predictions/services/prediction.service';
import { Prediction, PredictionDocument } from '../../predictions/models/prediction.model';
import { FinancialDashboardService } from '../../financial-planning/services/financial-dashboard.service';
import { ScholarshipService } from '../../scholarships/services/scholarship.service';
import { RoadmapGeneratorService } from '../../roadmap/services/roadmap-generator.service';
import { WishlistService } from '../../wishlist/services/wishlist.service';
import { DomainException } from '../../../common/filters/domain.exception';
import { ReportData, ReportStudentSummary } from '../templates/report-data.types';
import { buildAdmissionPredictionSections, AdmissionPredictionDetailRow, AdmissionPredictionChoiceRow } from '../templates/sections/admission-prediction.section';
import { buildFinancialPlanningSections } from '../templates/sections/financial-planning.section';
import { buildScholarshipEligibilitySections } from '../templates/sections/scholarship-eligibility.section';
import { buildStudentProgressSections } from '../templates/sections/student-progress.section';

const MAX_DETAIL_ROWS = 6;

/**
 * DI hub mirroring CounsellorModule's ContextAggregatorService — injects the
 * data-owning services of every module a report pulls from, never reaches
 * into another module's raw Mongoose model except the Prediction schema
 * (imported directly, same precedent WishlistEnrichmentService already
 * uses in wishlist.module.ts to read collegeId/courseId per prediction).
 */
@Injectable()
export class ReportDataAggregatorService {
  constructor(
    @InjectModel(Prediction.name) private readonly predictionModel: Model<PredictionDocument>,
    private readonly userRepo: UserRepository,
    private readonly collegeRepo: CollegeRepository,
    private readonly predictionService: PredictionService,
    private readonly financialDashboardService: FinancialDashboardService,
    private readonly scholarshipService: ScholarshipService,
    private readonly roadmapGeneratorService: RoadmapGeneratorService,
    private readonly wishlistService: WishlistService,
  ) {}

  async buildAdmissionPredictionData(userId: string): Promise<ReportData> {
    const user = await this.requireUser(userId);

    const predictionDocs = await this.predictionModel.find({ userId, examCode: { $ne: 'ROI' } }).sort({ probabilityPercent: -1 }).exec();
    if (predictionDocs.length === 0) {
      throw new DomainException('UNPROCESSABLE', 'Shortlist at least one college and run a prediction before generating this report.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const collegeIds = Array.from(new Set(predictionDocs.map(p => p.collegeId)));
    const colleges = await this.collegeRepo.findByIds(collegeIds);
    const collegeById = new Map(colleges.map((c: any) => [String(c.id ?? c._id), c]));

    const topEntries = predictionDocs.slice(0, MAX_DETAIL_ROWS);
    const detailRows: AdmissionPredictionDetailRow[] = await Promise.all(topEntries.map(async p => {
      const college = collegeById.get(p.collegeId) as any;
      const course = college?.courses?.find((c: any) => c.courseId === p.courseId);
      const [roi, placement] = await Promise.all([
        this.predictionService.getRoi(userId, p.collegeId, p.courseId).catch(() => null),
        this.predictionService.getPlacementEstimate(p.collegeId, p.courseId).catch(() => null),
      ]);
      return {
        collegeId: p.collegeId, courseId: p.courseId,
        collegeName: college?.name ?? p.collegeId, courseName: course?.name ?? p.courseId,
        band: p.probabilityBand!, probabilityPercent: p.probabilityPercent!,
        trendingClosingRank: p.rationale?.trendingClosingRank ?? 0, studentRank: p.rationale?.studentRank ?? 0,
        confidenceLevel: p.rationale?.confidenceLevel ?? 'low',
        roi: roi ? { netCost: roi.netCost, projectedPackageAnnual: roi.projectedPackageAnnual, roiPercent: roi.roiPercent, paybackYears: roi.paybackYears } : null,
        placement,
        nirfRank: college?.accreditation?.nirfRank ?? null,
      };
    }));

    let choiceRows: AdmissionPredictionChoiceRow[] = [];
    const primaryExam = user.examProfiles?.[0];
    if (primaryExam) {
      const ranked = await this.predictionService
        .optimizeChoiceFilling(userId, primaryExam.examCode, user.preferences?.riskAppetite ?? 'balanced')
        .catch(() => []);
      choiceRows = ranked.map(r => {
        const college = collegeById.get(r.collegeId) as any;
        const course = college?.courses?.find((c: any) => c.courseId === r.courseId);
        return {
          priority: r.priority, collegeName: college?.name ?? r.collegeId, courseName: course?.name ?? r.courseId,
          band: r.band, probabilityPercent: r.probabilityPercent,
        };
      });
    }

    const { sections, aiSummary } = buildAdmissionPredictionSections({
      allBands: predictionDocs.map(p => p.probabilityBand!).filter(Boolean),
      detailRows,
      choiceRows,
    });

    return this.wrap('admission_prediction', 'Admission Prediction Report', user, sections, aiSummary);
  }

  async buildFinancialPlanningData(userId: string, params?: Record<string, unknown>): Promise<ReportData> {
    const user = await this.requireUser(userId);

    let collegeCourseIds = params?.collegeCourseIds as Array<{ collegeId: string; courseId: string }> | undefined;
    if (!collegeCourseIds || collegeCourseIds.length === 0) {
      const predictionDocs = await this.predictionModel.find({ userId, examCode: { $ne: 'ROI' } }).sort({ probabilityPercent: -1 }).limit(4).exec();
      collegeCourseIds = predictionDocs.map(p => ({ collegeId: p.collegeId, courseId: p.courseId }));
    }

    if (collegeCourseIds.length < 2) {
      throw new DomainException('UNPROCESSABLE', 'Shortlist at least 2 colleges (run predictions or pass collegeCourseIds) before generating a Financial Planning report.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const hostelRequired = (params?.hostelRequired as boolean | undefined) ?? user.preferences?.hostelRequired ?? true;
    const comparison = await this.financialDashboardService.getComparison(userId, {
      collegeCourseIds: collegeCourseIds.slice(0, 4), hostelRequired,
    });

    const { sections, aiSummary } = buildFinancialPlanningSections(comparison.rows);
    return this.wrap('financial_planning', 'Financial Planning Report', user, sections, aiSummary);
  }

  async buildScholarshipEligibilityData(userId: string): Promise<ReportData> {
    const user = await this.requireUser(userId);

    const [recommendations, bookmarks] = await Promise.all([
      this.scholarshipService.getRecommended(userId),
      this.scholarshipService.listBookmarks(userId),
    ]);

    const { sections, aiSummary } = buildScholarshipEligibilitySections({ recommendations, bookmarks });
    return this.wrap('scholarship_eligibility', 'Scholarship Eligibility Report', user, sections, aiSummary);
  }

  async buildStudentProgressData(userId: string): Promise<ReportData> {
    const user = await this.requireUser(userId);

    // Deliberately does NOT call UserService.getDashboardSummary() —
    // that method currently hardcodes savedCollegesCount/predictionsCount/
    // scholarshipsEligibleCount/careerRoadmapProgressPercent to 0. A
    // downloadable report must reflect real counts, so each is computed
    // directly from its owning module here instead.
    const [completion, wishlist, predictionDocsCount, recommendations, roadmap] = await Promise.all([
      this.userRepo.findById(userId).then(u => this.profileCompletionPercent(u)),
      this.wishlistService.getWishlist(userId, {} as any),
      this.predictionModel.countDocuments({ userId, examCode: { $ne: 'ROI' } }).exec(),
      this.scholarshipService.getRecommended(userId).catch(() => []),
      this.roadmapGeneratorService.getActive(userId),
    ]);

    const eligibleCount = recommendations.filter(r => r.eligibility.verdict === 'eligible').length;

    const { sections, aiSummary } = buildStudentProgressSections({
      profileCompletionPercent: completion,
      examsCount: user.examProfiles?.length ?? 0,
      savedCollegesCount: wishlist.colleges.length,
      predictionsCount: predictionDocsCount,
      scholarshipsEligibleCount: eligibleCount,
      roadmapCompletionPercent: roadmap?.analytics?.completionPercent ?? 0,
      roadmapSkillScore: roadmap?.analytics?.skillScore ?? null,
      achievements: roadmap?.analytics?.achievements ?? [],
      memberSince: (user as any).createdAt,
    });

    return this.wrap('student_progress', 'Student Progress Report', user, sections, aiSummary);
  }

  // ── Shared helpers ─────────────────────────────────────────────────────

  private async requireUser(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new DomainException('NOT_FOUND', 'Student profile not found.', HttpStatus.NOT_FOUND);
    return user;
  }

  private async profileCompletionPercent(user: any): Promise<number> {
    // Mirrors UserService.getProfileCompletion's checklist without a second
    // DB round-trip (we already have `user` loaded).
    if (!user) return 0;
    const checks = [
      !!user.photoUrl,
      !!(user.dob && user.gender && user.domicileState && user.city),
      !!(user.academic?.currentQualification && user.academic?.twelfthPercentage),
      (user.examProfiles?.length ?? 0) > 0,
      !!user.categoryReservation?.reservationCategory,
      (user.preferences?.preferredCourses?.length ?? 0) > 0,
      !!(user.aiPersonalization?.careerGoal && (user.aiPersonalization?.skills?.length ?? 0) > 0),
      !!user.isEmailVerified,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  private wrap(reportType: ReportData['reportType'], reportTitle: string, user: any, sections: ReportData['sections'], aiSummary: string): ReportData {
    return {
      reportType, reportTitle, generatedAt: new Date(),
      student: this.studentSummary(user), sections, aiSummary,
    };
  }

  private studentSummary(user: any): ReportStudentSummary {
    return {
      fullName: user.fullName ?? 'Student',
      email: user.email,
      category: user.category,
      domicileState: user.domicileState,
      examProfiles: (user.examProfiles ?? []).map((ep: any) => ({ examCode: ep.examCode, rank: ep.rank, year: ep.year })),
    };
  }
}
