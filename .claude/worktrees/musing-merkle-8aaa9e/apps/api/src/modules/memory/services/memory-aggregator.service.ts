import { Injectable, Logger } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { UserRepository } from '../../users/repositories/user.repository';
import { WishlistService } from '../../wishlist/services/wishlist.service';
import { RecentlyViewedService } from '../../wishlist/services/recently-viewed.service';
import { SearchHistoryService } from '../../search/services/search-history.service';
import { ConversationMemoryService } from '../../counsellor/services/conversation-memory.service';
import { CounsellorService } from '../../counsellor/services/counsellor.service';
import { PredictionService } from '../../predictions/services/prediction.service';
import { FinancialPlanScenarioService } from '../../financial-planning/services/financial-plan-scenario.service';
import { ScholarshipService } from '../../scholarships/services/scholarship.service';
import { ScholarshipInteractionService } from '../../scholarships/services/scholarship-interaction.service';
import { RoadmapGeneratorService } from '../../roadmap/services/roadmap-generator.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { ConsentService } from './consent.service';
import { SessionStateService } from './session-state.service';
import { DomainException } from '../../../common/filters/domain.exception';
import { MEMORY_CATEGORIES, UpdatePersonalizationSettingsDto } from '../dto/memory.dto';

/**
 * Read-only facade behind the Memory & Privacy page and admin export/reset
 * flows. Deliberately owns no student-facing data of its own beyond consent
 * and session-state — every other category is read from (and deleted
 * through) the module that already owns it, so this never duplicates a
 * store another feature already maintains.
 */
@Injectable()
export class MemoryAggregatorService {
  private readonly logger = new Logger('MemoryAggregatorService');

  constructor(
    private readonly userRepo: UserRepository,
    private readonly wishlistService: WishlistService,
    private readonly recentlyViewedService: RecentlyViewedService,
    private readonly searchHistoryService: SearchHistoryService,
    private readonly conversationMemoryService: ConversationMemoryService,
    private readonly counsellorService: CounsellorService,
    private readonly predictionService: PredictionService,
    private readonly financialPlanScenarioService: FinancialPlanScenarioService,
    private readonly scholarshipService: ScholarshipService,
    private readonly scholarshipInteractionService: ScholarshipInteractionService,
    private readonly roadmapGeneratorService: RoadmapGeneratorService,
    private readonly notificationService: NotificationService,
    private readonly consentService: ConsentService,
    private readonly sessionStateService: SessionStateService,
  ) {}

  async getSummary(userId: string): Promise<Record<string, unknown>> {
    const [
      user, wishlist, recentlyViewed, recentSearches, savedSearches, rememberedSlots, aiSessions,
      predictions, financialHistory, scholarshipBookmarks, scholarshipInteractions,
      roadmap, notifications, consent, sessionState,
    ] = await Promise.all([
      this.userRepo.findById(userId),
      this.safe(() => this.wishlistService.getWishlist(userId, {} as any), { lists: [], colleges: [] }),
      this.safe(() => this.recentlyViewedService.list(userId), []),
      this.safe(() => this.searchHistoryService.listRecent(userId, 20), []),
      this.safe(() => this.searchHistoryService.listSaved(userId), []),
      this.safe(() => this.conversationMemoryService.getSlots(userId), {}),
      this.safe(() => this.counsellorService.listSessions(userId), []),
      this.safe(() => this.predictionService.getShortlistPredictions(userId), []),
      this.safe(() => this.financialPlanScenarioService.listHistory(userId), []),
      this.safe(() => this.scholarshipService.listBookmarks(userId), []),
      this.safe(() => this.scholarshipInteractionService.listForUser(userId), []),
      this.safe(() => this.roadmapGeneratorService.getOrGenerate(userId), null),
      this.safe(() => this.notificationService.listForUser(userId, {}, 1, 20), { notifications: [], total: 0 }),
      this.consentService.getConsent(userId),
      this.sessionStateService.getState(userId),
    ]);

    return {
      profile: user ? {
        fullName: user.fullName,
        preferredLanguage: user.preferredLanguage,
        preferredTheme: user.preferredTheme,
        preferredExam: user.preferences?.preferredExam,
        preferredCourses: user.preferences?.preferredCourses,
        preferredColleges: user.preferences?.preferredColleges,
        preferredLocation: user.preferences?.preferredCities,
        budgetMax: user.preferences?.budgetMax,
        careerGoal: user.aiPersonalization?.careerGoal,
        currentSemester: user.academic?.currentSemester,
        currentCollege: user.academic?.currentCollege,
      } : null,
      aiConversationMemory: { rememberedSlots, sessions: aiSessions },
      searchMemory: { recentSearches, savedSearches },
      recommendationMemory: { saved: wishlist, recentlyViewed },
      admissionPredictorMemory: { predictions },
      financialPlannerMemory: { history: financialHistory },
      scholarshipMemory: { bookmarks: scholarshipBookmarks, interactions: scholarshipInteractions },
      careerRoadmapMemory: roadmap ? {
        careerName: (roadmap as any).careerName,
        analytics: (roadmap as any).analytics,
        phases: (roadmap as any).phases,
      } : null,
      notificationMemory: notifications,
      consent: {
        necessary: consent.necessary, functional: consent.functional, analytics: consent.analytics,
        preference: consent.preference, aiPersonalization: consent.aiPersonalization,
        policyVersion: consent.policyVersion, updatedAt: (consent as any).updatedAt,
      },
      sessionState,
      personalizationSettings: user ? {
        aiPersonalizationEnabled: user.aiPersonalization?.receiveAiSuggestions ?? true,
        conversationMemoryEnabled: user.aiPersonalization?.conversationMemoryEnabled ?? true,
        searchHistoryEnabled: user.aiPersonalization?.searchHistoryEnabled ?? true,
      } : null,
    };
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    return { exportedAt: new Date().toISOString(), userId, ...(await this.getSummary(userId)) };
  }

  async deleteCategory(userId: string, category: string): Promise<void> {
    switch (category) {
      case 'searchHistory':
        return this.searchHistoryService.clearAll(userId);
      case 'conversationHistory':
        return this.counsellorService.deleteAllSessions(userId);
      case 'aiMemorySlots':
        return this.conversationMemoryService.clearSlots(userId);
      case 'recentlyViewedColleges':
        await this.recentlyViewedService.clear(userId);
        return;
      case 'financialPlanHistory':
        return this.financialPlanScenarioService.clear(userId);
      case 'scholarshipInteractions':
        return this.scholarshipInteractionService.clear(userId);
      case 'sessionState':
        return this.sessionStateService.clear(userId);
      default:
        throw new DomainException(
          'UNPROCESSABLE',
          `Unknown memory category "${category}". Valid categories: ${MEMORY_CATEGORIES.join(', ')}.`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
    }
  }

  /**
   * Clears AI-inferred/conversational memory and restores personalization
   * toggles to their defaults. Deliberately does NOT touch explicit profile
   * answers (preferredCourses, careerGoal, etc.) — those are the student's
   * own deliberate onboarding input, not something a "reset" should erase;
   * editing them is the profile page's job, not this one's.
   */
  async resetPersonalization(userId: string): Promise<void> {
    await Promise.all([
      this.conversationMemoryService.clearSlots(userId),
      this.sessionStateService.clear(userId),
      this.userRepo.updateProfile(userId, {
        'aiPersonalization.receiveAiSuggestions': true,
        'aiPersonalization.conversationMemoryEnabled': true,
        'aiPersonalization.searchHistoryEnabled': true,
      } as any),
    ]);
  }

  async updatePersonalizationSettings(userId: string, dto: UpdatePersonalizationSettingsDto): Promise<void> {
    const fields: Record<string, unknown> = {};
    if (dto.aiPersonalizationEnabled !== undefined) fields['aiPersonalization.receiveAiSuggestions'] = dto.aiPersonalizationEnabled;
    if (dto.conversationMemoryEnabled !== undefined) fields['aiPersonalization.conversationMemoryEnabled'] = dto.conversationMemoryEnabled;
    if (dto.searchHistoryEnabled !== undefined) fields['aiPersonalization.searchHistoryEnabled'] = dto.searchHistoryEnabled;
    if (Object.keys(fields).length === 0) return;
    await this.userRepo.updateProfile(userId, fields as any);
  }

  private async safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      this.logger.warn(`Memory summary partial read failed: ${(err as Error).message}`);
      return fallback;
    }
  }
}
