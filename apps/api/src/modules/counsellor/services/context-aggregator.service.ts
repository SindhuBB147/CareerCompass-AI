import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../../users/repositories/user.repository';
import { CollegeRepository } from '../../colleges/repositories/college.repository';
import { CutoffService } from '../../cutoffs/cutoff.service';
import { PredictionService } from '../../predictions/services/prediction.service';
import { ScholarshipService } from '../../scholarships/services/scholarship.service';
import { FinancialDashboardService } from '../../financial-planning/services/financial-dashboard.service';
import { RoadmapGeneratorService } from '../../roadmap/services/roadmap-generator.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { ReportGeneratorService } from '../../student-reports/services/report-generator.service';
import { REPORT_TYPE_LABELS } from '../../student-reports/report-labels';
import { StructuredContextItem } from '../../../common/ai-client/ai-service.client';
import { buildStudentContext } from '../../../common/utils/student-context.util';
import { RememberedSlots } from './conversation-memory.service';

const TOPIC_KEYWORDS: Record<string, string[]> = {
  admissions: ['college', 'cutoff', 'rank', 'admission', 'admit', 'safe', 'chance', 'seat', 'compare', 'counselling', 'counseling', 'branch', 'choice'],
  scholarship: ['scholarship', 'qualify', 'eligible', 'eligibility', 'document', 'deadline', 'award'],
  financial: ['fee', 'cost', 'hostel', 'loan', 'emi', 'roi', 'budget', 'expense', 'afford', 'tuition'],
  career: ['skill', 'certification', 'internship', 'career', 'roadmap', 'job', 'placement prep'],
};

export interface AggregatedContext {
  studentContext: Record<string, unknown>;
  structuredContext: StructuredContextItem[];
}

/**
 * Gathers the "structured context" the AI Counsellor prompt is grounded
 * in — student profile plus whatever platform data (colleges, cutoffs,
 * scholarships, predictions, financial estimates, roadmap) is relevant to
 * the current query. Every field comes from the platform's own
 * repositories/services (never invented), matching the guardrail that the
 * LLM must not fabricate facts.
 */
@Injectable()
export class ContextAggregatorService {
  private readonly logger = new Logger('ContextAggregatorService');

  constructor(
    private readonly userRepo: UserRepository,
    private readonly collegeRepo: CollegeRepository,
    private readonly cutoffService: CutoffService,
    private readonly predictionService: PredictionService,
    private readonly scholarshipService: ScholarshipService,
    private readonly financialDashboardService: FinancialDashboardService,
    private readonly roadmapGeneratorService: RoadmapGeneratorService,
    private readonly notificationService: NotificationService,
    private readonly reportGeneratorService: ReportGeneratorService,
  ) {}

  async gather(userId: string, query: string, rememberedSlots?: RememberedSlots): Promise<AggregatedContext> {
    const user = await this.userRepo.findById(userId);
    const topics = this.detectTopics(query);
    const structuredContext: StructuredContextItem[] = [];

    const studentContext = buildStudentContext(user) as unknown as Record<string, unknown>;

    if (rememberedSlots && Object.values(rememberedSlots).some(v => v !== undefined && v !== false)) {
      structuredContext.push({
        type: 'memory',
        id: `memory-${userId}`,
        title: 'Remembered from this conversation',
        content: `The student previously mentioned, in this or an earlier session: ${this.summarizeSlots(rememberedSlots)}. ` +
          'Use this as context for the current question — do not ask the student to repeat it unless the current question conflicts with it.',
      });
    }

    // Colleges — cheap and broadly relevant, so always attempted. The search
    // query is augmented with remembered course/city facts the student
    // mentioned in an earlier turn but didn't repeat in this literal message
    // (e.g. "recommend colleges" after an earlier "I want CSE in Bangalore").
    let matchedColleges: any[] = [];
    try {
      const augmentedQuery = this.augmentQuery(query, rememberedSlots);
      const result = await this.collegeRepo.search({ q: augmentedQuery, page: 1, limit: 3 });
      matchedColleges = result.results ?? [];
      for (const college of matchedColleges) {
        const latestPlacement = [...(college.placementSummary ?? [])].sort((a: any, b: any) => b.year - a.year)[0];
        structuredContext.push({
          type: 'college',
          id: String(college._id ?? college.id),
          title: college.name,
          content: `${college.name}, ${college.city ?? college.state}. Type: ${college.collegeType}. NIRF rank: ${college.accreditation?.nirfRank ?? 'N/A'}, NAAC: ${college.accreditation?.naac ?? 'N/A'}. ` +
            `Courses: ${(college.courses ?? []).map((c: any) => c.name).join(', ') || 'N/A'}. ` +
            (latestPlacement ? `Placement ${latestPlacement.year}: ${latestPlacement.placementPercentage}% placed, median package ₹${latestPlacement.medianPackage}.` : 'No placement data on file.'),
        });
      }
    } catch (err) {
      this.logger.warn(`College lookup failed: ${(err as Error).message}`);
    }

    if (topics.has('admissions') && user) {
      await this.addPredictionsAndCutoffs(userId, user, matchedColleges, structuredContext);
    }

    if (topics.has('scholarship') && user) {
      try {
        const matches = await this.scholarshipService.getMatched(userId);
        for (const s of matches.slice(0, 4)) {
          structuredContext.push({
            type: 'scholarship',
            id: String((s as any)._id ?? (s as any).id),
            title: s.name,
            content: `${s.name} (${s.provider}). ${s.description ?? ''} Award: ${s.awardAmount.type === 'percentage' ? `${s.awardAmount.value}% fee waiver` : `₹${s.awardAmount.value}`}. Deadline: ${new Date(s.applicationDeadline).toDateString()}.`,
          });
        }
      } catch (err) {
        this.logger.warn(`Scholarship match failed: ${(err as Error).message}`);
      }
    }

    if (topics.has('financial') && matchedColleges.length > 0) {
      try {
        const college = matchedColleges[0];
        const course = this.pickCourse(college, user);
        if (course) {
          const collegeId = String(college._id ?? college.id);
          // getDashboard() already calls PredictionService.getRoi() internally
          // and returns it as `roi` — reuse that instead of a second call, so
          // ROI context (previously never surfaced to the AI Counsellor at
          // all) comes for free alongside the cost breakdown.
          const dashboard = await this.financialDashboardService.getDashboard(userId, {
            collegeId, courseId: course.courseId,
            hostelRequired: user?.preferences?.hostelRequired ?? true,
          });
          structuredContext.push({
            type: 'financial',
            id: `financial-${collegeId}`,
            title: `Estimated cost at ${college.name}`,
            content: `Total program cost (${dashboard.feeBreakdown.durationYears} years): ₹${dashboard.feeBreakdown.totalProgramCost}. ` +
              `Estimated scholarship savings: ₹${dashboard.scholarshipSavings.totalEstimatedSavings}. ` +
              `Net financial burden: ₹${dashboard.netFinancialBurden}. ` +
              `Estimated loan needed: ₹${dashboard.loanAmountNeeded}` + (dashboard.estimatedEmi > 0 ? ` (EMI ≈ ₹${dashboard.estimatedEmi}/month).` : '.'),
          });
          if (dashboard.roi.projectedPackageAnnual > 0) {
            structuredContext.push({
              type: 'roi',
              id: `roi-${collegeId}`,
              title: `Return on investment at ${college.name}`,
              content: `Expected salary after graduation: ₹${dashboard.roi.projectedPackageAnnual}/year (placement rate: ${dashboard.roi.placementPercentage ?? 'N/A'}%). ` +
                `Payback period: ${dashboard.roi.paybackYears} years. Estimated 10-year ROI: ${dashboard.roi.roiPercent}%.`,
            });
          }
        }
      } catch (err) {
        this.logger.warn(`Financial dashboard failed: ${(err as Error).message}`);
      }
    }

    if (topics.has('career') && user) {
      try {
        const roadmap = await this.roadmapGeneratorService.getOrGenerate(userId);
        if (roadmap) {
          const milestones = roadmap.phases.flatMap(p => p.milestones.map(m => ({ ...m, phaseLabel: p.label })));
          const incomplete = milestones.filter(m => m.status !== 'completed' && m.status !== 'locked')
            .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1));
          const nextUp = incomplete.slice(0, 6);
          const completedCount = milestones.filter(m => m.status === 'completed').length;
          const milestoneSummary = nextUp.map(m => `${m.phaseLabel} (${m.category}, ${m.priority} priority): ${m.title} — ${m.description}`).join(' | ');
          structuredContext.push({
            type: 'roadmap',
            id: `roadmap-${userId}`,
            title: `Career roadmap for ${roadmap.careerName}`,
            content: `Progress: ${completedCount}/${milestones.length} milestones completed (${roadmap.analytics?.completionPercent ?? 0}%). Next up — ${milestoneSummary}`,
          });
        }
      } catch (err) {
        this.logger.warn(`Roadmap generation failed: ${(err as Error).message}`);
      }
    }

    if (topics.has('admissions')) {
      try {
        const { notifications } = await this.notificationService.listForUser(userId, { isRead: false }, 1, 5);
        for (const n of notifications) {
          structuredContext.push({
            type: 'notification',
            id: String(n._id ?? n.id),
            title: n.title,
            content: `${n.message} (${n.priority} priority, ${n.category}, ${new Date(n.scheduledFor ?? n.sentAt ?? Date.now()).toDateString()}).`,
          });
        }
      } catch (err) {
        this.logger.warn(`Notification lookup failed: ${(err as Error).message}`);
      }
    }

    // Reports — cheap indexed query, always attempted like colleges, so the
    // counsellor can reference "your report from last week" when relevant.
    try {
      const reports = await this.reportGeneratorService.listRecentForUser(userId, 3);
      for (const r of reports) {
        structuredContext.push({
          type: 'report',
          id: String(r._id ?? r.id),
          title: REPORT_TYPE_LABELS[r.reportType] ?? r.reportType,
          content: `Generated ${new Date(r.generatedAt).toDateString()} (${r.format.toUpperCase()} format). Available for the student to re-download from Reports.`,
        });
      }
    } catch (err) {
      this.logger.warn(`Report lookup failed: ${(err as Error).message}`);
    }

    return { studentContext, structuredContext };
  }

  private async addPredictionsAndCutoffs(
    userId: string,
    user: any,
    matchedColleges: any[],
    structuredContext: StructuredContextItem[],
  ): Promise<void> {
    for (const college of matchedColleges.slice(0, 2)) {
      const course = this.pickCourse(college, user);
      if (!course) continue;

      const examProfile = (user.examProfiles ?? []).find((ep: any) => course.examsAccepted?.includes(ep.examCode));
      if (!examProfile) continue;

      try {
        const prediction = await this.predictionService.getPrediction(userId, String(college._id ?? college.id), course.courseId, examProfile.examCode);
        structuredContext.push({
          type: 'prediction',
          id: `pred-${college._id}-${course.courseId}`,
          title: `Admission probability: ${course.name} at ${college.name}`,
          content: `${prediction.probabilityBand} chance (${prediction.probabilityPercent}%). Trending closing rank: ${prediction.rationale.trendingClosingRank}, your rank: ${prediction.rationale.studentRank}. Confidence: ${prediction.rationale.confidenceLevel}.`,
        });
      } catch (err) {
        this.logger.warn(`Prediction failed for ${college.name}/${course.courseId}: ${(err as Error).message}`);
      }

      try {
        const trend = await this.cutoffService.getTrend(
          String(college._id ?? college.id), course.courseId, examProfile.examCode, examProfile.categoryUsed ?? user.category ?? 'General',
        );
        if (trend.length > 0) {
          const trendText = trend.map((t: any) => `${t.year} R${t.round}: closing rank ${t.closingRank}`).join(', ');
          structuredContext.push({
            type: 'cutoff',
            id: `cutoff-${college._id}-${course.courseId}`,
            title: `${course.name} cutoff trend at ${college.name} (${examProfile.examCode})`,
            content: `Historical closing ranks — ${trendText}.`,
          });
        }
      } catch (err) {
        this.logger.warn(`Cutoff trend failed for ${college.name}/${course.courseId}: ${(err as Error).message}`);
      }
    }
  }

  private augmentQuery(query: string, rememberedSlots?: RememberedSlots): string {
    if (!rememberedSlots) return query;
    const lowered = query.toLowerCase();
    const additions = [rememberedSlots.discipline, rememberedSlots.city]
      .filter((term): term is string => !!term && !lowered.includes(term.toLowerCase()));
    return additions.length > 0 ? `${query} ${additions.join(' ')}` : query;
  }

  private summarizeSlots(slots: RememberedSlots): string {
    const parts: string[] = [];
    if (slots.discipline) parts.push(`course: ${slots.discipline}`);
    if (slots.city) parts.push(`preferred city: ${slots.city}`);
    if (slots.examCode) parts.push(`exam: ${slots.examCode}`);
    if (slots.category) parts.push(`category: ${slots.category}`);
    if (slots.budgetMax) parts.push(`budget: ₹${slots.budgetMax}`);
    if (slots.collegeType) parts.push(`college type: ${slots.collegeType}`);
    if (slots.hostelRequired) parts.push('needs hostel');
    if (slots.placementFocus) parts.push('cares about placements');
    if (slots.scholarshipFocus) parts.push('interested in scholarships');
    if (slots.roiFocus) parts.push('interested in ROI');
    return parts.join(', ');
  }

  private pickCourse(college: any, user: any): any {
    const courses = college.courses ?? [];
    if (courses.length === 0) return null;
    const preferred = user?.preferences?.preferredCourses?.[0]?.toLowerCase();
    if (preferred) {
      const match = courses.find((c: any) => c.name.toLowerCase().includes(preferred));
      if (match) return match;
    }
    return courses[0];
  }

  private detectTopics(query: string): Set<string> {
    const lowered = query.toLowerCase();
    const topics = new Set<string>();
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (keywords.some(kw => lowered.includes(kw))) topics.add(topic);
    }
    if (topics.size === 0) topics.add('admissions'); // sensible default for an admissions counsellor
    return topics;
  }
}
