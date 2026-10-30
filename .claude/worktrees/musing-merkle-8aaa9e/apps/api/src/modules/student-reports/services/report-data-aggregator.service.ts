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
import { WishlistComparisonService } from '../../wishlist/services/wishlist-comparison.service';
import { DomainException } from '../../../common/filters/domain.exception';
import { ReportData, ReportStudentSummary } from '../templates/report-data.types';
import { buildAdmissionPredictionSections, AdmissionPredictionDetailRow, AdmissionPredictionChoiceRow } from '../templates/sections/admission-prediction.section';
import { buildFinancialPlanningSections } from '../templates/sections/financial-planning.section';
import { buildScholarshipEligibilitySections } from '../templates/sections/scholarship-eligibility.section';
import { buildStudentProgressSections } from '../templates/sections/student-progress.section';
import { buildCollegeComparisonSections } from '../templates/sections/college-comparison.section';
import { buildCareerRoadmapSections } from '../templates/sections/career-roadmap.section';
import { buildAiRecommendationSections } from '../templates/sections/ai-recommendation.section';
import { buildSavedCollegesSections } from '../templates/sections/saved-colleges.section';

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
    private readonly wishlistComparisonService: WishlistComparisonService,
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

  async buildCollegeComparisonData(userId: string, params?: Record<string, unknown>): Promise<ReportData> {
    const user = await this.requireUser(userId);

    let collegeIds = params?.collegeIds as string[] | undefined;
    if (!collegeIds || collegeIds.length === 0) {
      const wishlist = await this.wishlistService.getWishlist(userId, {} as any);
      collegeIds = wishlist.colleges.slice(0, 4).map(c => c.collegeId);
    }

    if (collegeIds.length < 2) {
      throw new DomainException('UNPROCESSABLE', 'Save at least 2 colleges to your wishlist (or pass collegeIds) before generating a College Comparison report.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const compared = await this.wishlistComparisonService.compare(userId, collegeIds.slice(0, 4));
    const { sections, aiSummary } = buildCollegeComparisonSections(compared);
    return this.wrap('college_comparison', 'College Comparison Report', user, sections, aiSummary);
  }

  async buildCareerRoadmapData(userId: string): Promise<ReportData> {
    const user = await this.requireUser(userId);

    const roadmap = await this.roadmapGeneratorService.getActive(userId);
    if (!roadmap) {
      throw new DomainException('UNPROCESSABLE', 'Generate a career roadmap before generating this report.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const { sections, aiSummary } = buildCareerRoadmapSections({
      careerName: roadmap.careerName,
      completionPercent: roadmap.analytics?.completionPercent ?? 0,
      skillScore: roadmap.analytics?.skillScore ?? 0,
      completedCount: roadmap.analytics?.completedCount ?? 0,
      totalCount: roadmap.analytics?.totalCount ?? 0,
      phases: (roadmap.phases ?? []).map(p => ({
        label: p.label, order: p.order,
        milestones: (p.milestones ?? []).map(m => ({ title: m.title, category: m.category, status: m.status, estimatedWeeks: m.estimatedWeeks })),
      })),
      achievements: (roadmap.analytics?.achievements ?? []).map(a => ({ label: a.label, earnedAt: a.earnedAt })),
    });

    return this.wrap('career_roadmap', 'Career Roadmap Report', user, sections, aiSummary);
  }

  async buildAiRecommendationData(userId: string): Promise<ReportData> {
    const user = await this.requireUser(userId);

    const predictionDocs = await this.predictionModel.find({ userId, examCode: { $ne: 'ROI' } }).sort({ probabilityPercent: -1 }).limit(3).exec();
    const collegeIds = Array.from(new Set(predictionDocs.map(p => p.collegeId)));
    const colleges = await this.collegeRepo.findByIds(collegeIds);
    const collegeById = new Map(colleges.map((c: any) => [String(c.id ?? c._id), c]));

    const recommendedColleges = await Promise.all(predictionDocs.map(async p => {
      const college = collegeById.get(p.collegeId) as any;
      const course = college?.courses?.find((c: any) => c.courseId === p.courseId);
      const roi = await this.predictionService.getRoi(userId, p.collegeId, p.courseId).catch(() => null);
      return {
        collegeName: college?.name ?? p.collegeId, courseName: course?.name ?? p.courseId,
        band: p.probabilityBand!, probabilityPercent: p.probabilityPercent!,
        roiPercent: roi?.roiPercent ?? null,
      };
    }));

    const scholarshipRecs = await this.scholarshipService.getRecommended(userId, 3).catch(() => []);
    const recommendedScholarships = scholarshipRecs.map(r => ({
      name: r.scholarship.name, tierLabel: r.tierLabel,
      awardDisplay: r.scholarship.awardAmount.displayText
        ?? (r.scholarship.awardAmount.type === 'percentage' ? `${r.scholarship.awardAmount.value}% of fees` : `₹${r.scholarship.awardAmount.value.toLocaleString('en-IN')}`),
    }));

    const roadmap = await this.roadmapGeneratorService.getActive(userId).catch(() => null);
    const nextMilestoneRaw = roadmap
      ? [...(roadmap.phases ?? [])].sort((a, b) => a.order - b.order).flatMap(p => p.milestones ?? []).find(m => m.status === 'not_started' || m.status === 'in_progress')
      : null;
    const nextMilestone = nextMilestoneRaw ? { title: nextMilestoneRaw.title, estimatedWeeks: nextMilestoneRaw.estimatedWeeks } : null;

    const { sections, aiSummary } = buildAiRecommendationSections({ colleges: recommendedColleges, scholarships: recommendedScholarships, nextMilestone });
    return this.wrap('ai_recommendation', 'AI Recommendation Report', user, sections, aiSummary);
  }

  async buildSavedCollegesData(userId: string): Promise<ReportData> {
    const user = await this.requireUser(userId);

    const wishlist = await this.wishlistService.getWishlist(userId, {} as any);
    if (wishlist.colleges.length === 0) {
      throw new DomainException('UNPROCESSABLE', 'Save at least one college to your wishlist before generating this report.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const listNameById = new Map(wishlist.lists.map(l => [l.id, l.name]));
    const rows = wishlist.colleges.map(c => ({
      collegeName: c.college.name,
      listNames: c.listIds.map(id => listNameById.get(id)).filter((n): n is string => !!n),
      status: c.status,
      admissionProbability: c.enrichment?.admissionProbability ?? null,
      savedAt: c.savedAt,
    }));

    const { sections, aiSummary } = buildSavedCollegesSections(rows);
    return this.wrap('saved_colleges', 'Saved Colleges Report', user, sections, aiSummary);
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
