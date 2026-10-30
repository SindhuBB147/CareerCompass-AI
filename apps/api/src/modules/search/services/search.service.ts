import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../../users/repositories/user.repository';
import { PredictionService } from '../../predictions/services/prediction.service';
import { FinancialDashboardService } from '../../financial-planning/services/financial-dashboard.service';
import { FinancialDashboardRequestDto } from '../../financial-planning/dto/dashboard.dto';
import { AiServiceClient, SearchEntities, StructuredContextItem } from '../../../common/ai-client/ai-service.client';
import { buildStudentContext } from '../../../common/utils/student-context.util';
import { SearchAggregatorService } from './search-aggregator.service';
import { CollegeRankingService, RankedCollege } from './college-ranking.service';
import { SearchHistoryService } from './search-history.service';
import { SearchQueryDto, SummarizeDto } from '../dto/search.dto';

// Colleges enriched with a per-user admission prediction + (top 1 only) a
// financial dashboard. Deliberately sequential and bounded to the
// already-ranked top few — never part of the initial candidate fan-out,
// since FinancialDashboardService needs a specific collegeId+courseId and
// its computation isn't free (see college-ranking.service.ts's doc comment).
const PREDICTION_ENRICH_COUNT = 3;
const FINANCIAL_ENRICH_COUNT = 1;

export interface CollegeResultCard {
  id: string;
  slug: string;
  name: string;
  bannerImage?: string;
  logo?: string;
  city: string;
  state: string;
  collegeType: string;
  nirfRank: number | null;
  naac: string | null;
  course: string | null;
  averagePackage: number | null;
  highestPackage: number | null;
  totalAnnualFee: number | null;
  hostelAvailable: boolean;
  scholarshipsAvailable: number | null;
  admissionProbability: { band: string; percent: number } | null;
  financialSummary: { totalProgramCost: number; netFinancialBurden: number } | null;
  aiScore: number;
  scoreBreakdown: RankedCollege['breakdown'];
}

export interface SearchResponse {
  intent: string;
  entities: SearchEntities;
  colleges: CollegeResultCard[];
  scholarships: Array<{ id: string; name: string; provider: string; awardAmount: unknown; applicationDeadline: Date }>;
  totalResults: number;
  suggestedFollowUps: string[];
  historyId: string | null;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger('SearchService');

  constructor(
    private readonly aiClient: AiServiceClient,
    private readonly userRepo: UserRepository,
    private readonly aggregator: SearchAggregatorService,
    private readonly ranking: CollegeRankingService,
    private readonly historyService: SearchHistoryService,
    private readonly predictionService: PredictionService,
    private readonly financialDashboardService: FinancialDashboardService,
  ) {}

  async search(userId: string, dto: SearchQueryDto): Promise<SearchResponse> {
    const [user, analysis] = await Promise.all([
      this.userRepo.findById(userId),
      this.aiClient.searchAnalyze(dto.query),
    ]);
    const studentContext = buildStudentContext(user);
    const entities = analysis.entities;

    const [collegeCandidates, scholarships, compareTargets] = await Promise.all([
      this.aggregator.findCandidateColleges(entities, dto.filters, studentContext, 30),
      entities.scholarship_focus ? this.aggregator.findScholarships(entities, studentContext, 10) : Promise.resolve([]),
      entities.action === 'compare' && entities.college_names.length >= 2
        ? this.aggregator.findCompareTargets(entities.college_names)
        : Promise.resolve([]),
    ]);

    const compareBoostIds = new Set(compareTargets.map((c: any) => String(c._id)));
    const allCandidates = this.mergeUnique([...compareTargets, ...collegeCandidates]);

    const ranked = this.ranking.rank(allCandidates, entities, studentContext, { compareBoostIds });
    const topRanked = ranked.slice(0, dto.limit ?? 10);

    const enrichment = await this.enrichTopColleges(userId, topRanked, entities, studentContext);

    const resultCounts = { colleges: ranked.length, scholarships: scholarships.length };
    let historyId: string | null = null;
    try {
      const historyDoc = await this.historyService.log(userId, dto.query, analysis.intent, entities as unknown as Record<string, unknown>, resultCounts);
      historyId = String(historyDoc._id);
    } catch (err) {
      this.logger.warn(`Failed to log search history: ${(err as Error).message}`);
    }

    return {
      intent: analysis.intent,
      entities,
      colleges: topRanked.map((r) => this.toCollegeResultCard(r, enrichment.get(String((r.college as any)._id)))),
      scholarships: scholarships.map((s: any) => ({
        id: String(s._id), name: s.name, provider: s.provider, awardAmount: s.awardAmount, applicationDeadline: s.applicationDeadline,
      })),
      totalResults: ranked.length,
      suggestedFollowUps: this.buildFollowUps(analysis.intent, entities),
      historyId,
    };
  }

  /**
   * AI-authored summary/reasoning/citations, reusing the existing
   * counsellor RAG pipeline (POST /rag/query) unmodified — which also pulls
   * in uploaded brochures/FAQs/admission-rules automatically via its own
   * retrieval step. Deliberately a *separate* call from search(): /rag/query
   * always invokes an LLM (real latency + cost), so it must never sit
   * inline in the primary, keystroke-adjacent /search response path.
   */
  async summarize(userId: string, dto: SummarizeDto) {
    const [user, analysis] = await Promise.all([
      this.userRepo.findById(userId),
      this.aiClient.searchAnalyze(dto.query),
    ]);
    const studentContext = buildStudentContext(user);
    const entities = analysis.entities;

    const candidates = await this.aggregator.findCandidateColleges(entities, undefined, studentContext, 10);
    const ranked = this.ranking.rank(candidates, entities, studentContext, {});
    const structuredContext: StructuredContextItem[] = ranked.slice(0, 5).map((r) => this.toStructuredContextItem(r));

    const result = await this.aiClient.query({
      query: dto.query,
      student_context: studentContext as unknown as Record<string, unknown>,
      structured_context: structuredContext,
      conversation_history: [],
    });

    return {
      summary: result.answer,
      reasoning: result.reasoning,
      citations: result.sources_cited,
      suggestedQuestions: result.suggested_questions,
      actionButtons: result.action_buttons,
      confidenceLevel: result.confidence_level,
      lowConfidence: result.low_confidence,
    };
  }

  async getSuggestions() {
    const [popularColleges, popularCourses, trending] = await Promise.all([
      this.aggregator.getPopularColleges(6),
      this.aggregator.getPopularCourses(8),
      this.historyService.popular(6),
    ]);
    return {
      popularColleges: popularColleges.map((c: any) => ({ id: String(c._id), name: c.name, slug: c.slug })),
      popularCourses,
      trendingSearches: trending.map((t) => t.query),
      suggestedQueries: SUGGESTED_QUERIES,
    };
  }

  private async enrichTopColleges(
    userId: string,
    ranked: RankedCollege[],
    entities: SearchEntities,
    studentContext: ReturnType<typeof buildStudentContext>,
  ): Promise<Map<string, { prediction?: { probabilityBand: string; probabilityPercent: number }; financial?: { totalProgramCost: number; netFinancialBurden: number }; course?: any }>> {
    const map = new Map<string, { prediction?: any; financial?: any; course?: any }>();
    const examCode = entities.exam ?? studentContext.examCode;

    for (const [index, { college }] of ranked.entries()) {
      const c: any = college;
      const course = this.pickCourse(c, examCode);
      if (!course) continue;
      const id = String(c._id);
      const entry: { prediction?: any; financial?: any; course?: any } = { course };

      if (index < PREDICTION_ENRICH_COUNT && examCode && studentContext.rank) {
        try {
          const prediction = await this.predictionService.getPrediction(userId, id, course.courseId, examCode);
          entry.prediction = { probabilityBand: prediction.probabilityBand, probabilityPercent: prediction.probabilityPercent };
        } catch (err) {
          this.logger.warn(`Prediction enrichment failed for ${c.name}: ${(err as Error).message}`);
        }
      }

      if (index < FINANCIAL_ENRICH_COUNT) {
        try {
          const dashboardDto: FinancialDashboardRequestDto = {
            collegeId: id, courseId: course.courseId, hostelRequired: entities.hostel_required || true,
          };
          const dashboard = await this.financialDashboardService.getDashboard(userId, dashboardDto);
          entry.financial = { totalProgramCost: dashboard.feeBreakdown.totalProgramCost, netFinancialBurden: dashboard.netFinancialBurden };
        } catch (err) {
          this.logger.warn(`Financial enrichment failed for ${c.name}: ${(err as Error).message}`);
        }
      }

      map.set(id, entry);
    }
    return map;
  }

  private pickCourse(college: any, examCode?: string): any | null {
    const courses = college.courses ?? [];
    if (courses.length === 0) return null;
    if (examCode) {
      const match = courses.find((c: any) => (c.examsAccepted ?? []).includes(examCode));
      if (match) return match;
    }
    return courses[0];
  }

  private mergeUnique(colleges: any[]): any[] {
    const seen = new Set<string>();
    const result: any[] = [];
    for (const college of colleges) {
      const id = String(college._id);
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(college);
    }
    return result;
  }

  private toCollegeResultCard(ranked: RankedCollege, enrichment?: { prediction?: any; financial?: any; course?: any }): CollegeResultCard {
    const c: any = ranked.college;
    const placements = c.placementSummary ?? [];
    const latest = [...placements].sort((a: any, b: any) => b.year - a.year)[0];
    return {
      id: String(c._id),
      slug: c.slug,
      name: c.name,
      bannerImage: c.bannerImage,
      logo: c.logo,
      city: c.city,
      state: c.state,
      collegeType: c.collegeType,
      nirfRank: c.accreditation?.nirfRank ?? null,
      naac: c.accreditation?.naac ?? null,
      course: enrichment?.course?.name ?? c.courses?.[0]?.name ?? null,
      averagePackage: latest?.averagePackage ?? null,
      highestPackage: latest?.highestPackage ?? null,
      totalAnnualFee: c.feeBreakdown?.totalAnnualFee ?? null,
      hostelAvailable: Boolean(c.hostelInfo?.boysHostel || c.hostelInfo?.girlsHostel),
      scholarshipsAvailable: null,
      admissionProbability: enrichment?.prediction
        ? { band: enrichment.prediction.probabilityBand, percent: enrichment.prediction.probabilityPercent }
        : null,
      financialSummary: enrichment?.financial ?? null,
      aiScore: Math.round(ranked.score * 100),
      scoreBreakdown: ranked.breakdown,
    };
  }

  private toStructuredContextItem(ranked: RankedCollege): StructuredContextItem {
    const c: any = ranked.college;
    const latest = [...(c.placementSummary ?? [])].sort((a: any, b: any) => b.year - a.year)[0];
    return {
      type: 'college',
      id: String(c._id),
      title: c.name,
      content: `${c.name}, ${c.city}, ${c.state}. Type: ${c.collegeType}. NIRF rank: ${c.accreditation?.nirfRank ?? 'N/A'}, NAAC: ${c.accreditation?.naac ?? 'N/A'}. ` +
        `Annual fee: ₹${c.feeBreakdown?.totalAnnualFee ?? 'N/A'}. Hostel: ${c.hostelInfo?.boysHostel || c.hostelInfo?.girlsHostel ? 'available' : 'not listed'}. ` +
        (latest ? `Placement ${latest.year}: ${latest.placementPercentage}% placed, average package ₹${latest.averagePackage}.` : 'No placement data on file.'),
    };
  }

  private buildFollowUps(intent: string, entities: SearchEntities): string[] {
    const suggestions: string[] = [];
    if (intent !== 'compare_colleges') suggestions.push('Compare these colleges');
    suggestions.push('Predict my admission chances');
    if (!entities.scholarship_focus) suggestions.push('Show scholarships for these colleges');
    if (!entities.placement_focus) suggestions.push('Show placements and ROI');
    if (!entities.hostel_required) suggestions.push('Show hostel details');
    return suggestions.slice(0, 4);
  }
}

const SUGGESTED_QUERIES = [
  'Best CSE colleges under ₹2 lakh',
  'Government engineering colleges in Bangalore',
  'Medical colleges accepting my NEET rank',
  'Top colleges with hostel',
  'Best ROI colleges',
  'Scholarships for SC students',
  'Colleges with AI & ML',
  'Show colleges with NIRF rank below 50',
];
