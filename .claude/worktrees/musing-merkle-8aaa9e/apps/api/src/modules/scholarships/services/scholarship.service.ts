import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ScholarshipRepository, ScholarshipSearchFilters } from '../repositories/scholarship.repository';
import { ScholarshipBookmarkRepository } from '../repositories/scholarship-bookmark.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { UserDocument } from '../../users/models/user.model';
import { NotificationService } from '../../notifications/services/notification.service';
import { NOTIFICATION_EVENTS } from '../../notifications/events/notification.events';
import { EligibilityEngineService, EligibilityReport } from './eligibility-engine.service';
import { RecommendationService, ScholarshipRecommendation } from './recommendation.service';
import { ScholarshipInteractionService } from './scholarship-interaction.service';
import { Scholarship, ScholarshipDocument } from '../models/scholarship.model';
import { CreateScholarshipDto, UpdateScholarshipDto } from '../dto/scholarship.dto';
import { DomainException } from '../../../common/filters/domain.exception';
import { SCHOLARSHIP_SEED_DATA } from './scholarship-seed-data';

@Injectable()
export class ScholarshipService implements OnModuleInit {
  private readonly logger = new Logger('ScholarshipService');

  constructor(
    private readonly repo: ScholarshipRepository,
    private readonly userRepo: UserRepository,
    private readonly bookmarkRepo: ScholarshipBookmarkRepository,
    private readonly eligibilityEngine: EligibilityEngineService,
    private readonly recommendationService: RecommendationService,
    private readonly notificationService: NotificationService,
    private readonly interactionService: ScholarshipInteractionService,
    private readonly events: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seedInitialScholarshipsIfEmpty();
    } catch {
      // Ignore seed error if DB is unreachable in offline mode (matches CollegeService's seed pattern).
    }
  }

  /** Mirrors database/seed.ts's scholarship seed (which only runs when
   * manually invoked against a real Mongo) so a fresh boot has real,
   * browsable data — including the Admission Predictor's scholarshipsCount
   * field and the AI Counsellor's scholarship context.
   *
   * Upserts by slug (rather than skipping entirely once any data exists) so
   * new catalogue entries added to SCHOLARSHIP_SEED_DATA reach an
   * already-seeded database on the next boot, without touching or
   * duplicating scholarships that are already there. */
  private async seedInitialScholarshipsIfEmpty(): Promise<void> {
    let seededCount = 0;
    for (const scholarship of SCHOLARSHIP_SEED_DATA) {
      const existing = await this.repo.findBySlug(scholarship.slug);
      if (existing) continue;
      await this.repo.create(scholarship as unknown as Partial<Scholarship>);
      seededCount++;
    }
    if (seededCount > 0) this.logger.log(`Seeded ${seededCount} new scholarship(s).`);
  }

  // ── Student-facing browse/search ────────────────────────────────────────

  async search(filters: ScholarshipSearchFilters, page: number, limit: number) {
    return this.repo.search({ ...filters, isActive: filters.isActive ?? true }, page, limit);
  }

  listFeatured(limit = 6) {
    return this.repo.findFeatured(limit);
  }

  async getDetail(idOrSlug: string): Promise<ScholarshipDocument> {
    const s = await this.findByIdOrSlug(idOrSlug);
    if (!s) throw new DomainException('NOT_FOUND', 'Scholarship not found.', HttpStatus.NOT_FOUND);
    return s;
  }

  /** Accepts either a Mongo ObjectId or a slug — every route that takes a
   * scholarship reference from a URL (detail, eligibility, bookmarks)
   * needs to resolve both, since detail pages are slugged but some callers
   * (bookmarks, the admin panel) address scholarships by id. */
  private findByIdOrSlug(idOrSlug: string) {
    return /^[0-9a-fA-F]{24}$/.test(idOrSlug)
      ? this.repo.findById(idOrSlug)
      : this.repo.findBySlug(idOrSlug);
  }

  // ── Eligibility & recommendations ───────────────────────────────────────

  async checkEligibility(userId: string, scholarshipId: string): Promise<EligibilityReport> {
    const [user, scholarship] = await Promise.all([
      this.userRepo.findById(userId),
      this.findByIdOrSlug(scholarshipId),
    ]);
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });
    if (!scholarship) throw new DomainException('NOT_FOUND', 'Scholarship not found.', HttpStatus.NOT_FOUND);
    const report = await this.eligibilityEngine.evaluate(user, scholarship);
    this.interactionService.record(userId, scholarship.id, 'eligibility_checked', { verdict: report.verdict });
    return report;
  }

  async getRecommended(userId: string, limit?: number): Promise<ScholarshipRecommendation[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });

    const active = await this.repo.listActive();
    const upcoming = active.filter(s => s.applicationDeadline > new Date());
    return this.recommendationService.recommend(user, upcoming, limit);
  }

  /** Legacy matcher (category/state/exam only, no scored ranking) — kept
   * for the AI Counsellor's context aggregator, which just needs a short
   * list of plausibly-relevant scholarships to summarize, not a full
   * eligibility breakdown. */
  async getMatched(userId: string): Promise<ScholarshipDocument[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });

    const examCodes = user.examProfiles?.map(ep => ep.examCode) ?? [];
    return this.repo.findMatching({
      category: user.category,
      state: user.domicileState,
      examCodes,
    });
  }

  /**
   * Same matching as `getMatched`, but for a raw category/state/exam
   * profile rather than a stored user — used by the Admission Probability
   * Predictor, which is anonymous (no login required).
   */
  async countMatchingForProfile(category: string | undefined, state: string | undefined, examCode: string): Promise<number> {
    const normalizedCategory = category === 'GM' ? 'General' : category;
    const matches = await this.repo.findMatching({ category: normalizedCategory, state, examCodes: [examCode] });
    return matches.length;
  }

  // ── Bookmarks ────────────────────────────────────────────────────────────

  async addBookmark(userId: string, scholarshipId: string): Promise<void> {
    const scholarship = await this.findByIdOrSlug(scholarshipId);
    if (!scholarship) throw new DomainException('NOT_FOUND', 'Scholarship not found.', HttpStatus.NOT_FOUND);
    // Always store the canonical ObjectId, even if the caller passed a
    // slug — listBookmarks() resolves bookmarks by `_id: { $in: ... }`.
    await this.bookmarkRepo.add(userId, scholarship.id);
  }

  async removeBookmark(userId: string, scholarshipId: string): Promise<void> {
    await this.bookmarkRepo.remove(userId, scholarshipId);
  }

  async listBookmarks(userId: string): Promise<ScholarshipDocument[]> {
    const bookmarks = await this.bookmarkRepo.listForUser(userId);
    if (bookmarks.length === 0) return [];
    return this.repo.findByIds(bookmarks.map(b => b.scholarshipId));
  }

  // ── Admin CRUD ───────────────────────────────────────────────────────────

  async create(dto: CreateScholarshipDto): Promise<ScholarshipDocument> {
    const duplicate = await this.repo.findByExactName(dto.name);
    if (duplicate) {
      throw new DomainException('CONFLICT', `A scholarship named "${dto.name}" already exists.`, HttpStatus.CONFLICT);
    }
    // Mutate + pass `dto` directly rather than `{ ...dto, slug }` — class-transformer's
    // @Type()-converted fields (e.g. applicationDeadline: string -> Date) aren't always
    // enumerable own properties, so a spread can silently drop them before they reach
    // Mongoose, which then reports the field as missing.
    (dto as unknown as { slug: string }).slug = slugify(dto.name);
    const created = await this.repo.create(dto as unknown as Partial<Scholarship>);
    this.notifyMatchingStudents(created).catch(err => this.logger.warn(`New-scholarship notification fan-out failed: ${(err as Error).message}`));
    return created;
  }

  async update(id: string, dto: UpdateScholarshipDto): Promise<ScholarshipDocument> {
    if (dto.name) {
      const duplicate = await this.repo.findByExactName(dto.name, id);
      if (duplicate) {
        throw new DomainException('CONFLICT', `A scholarship named "${dto.name}" already exists.`, HttpStatus.CONFLICT);
      }
    }
    const wasActive = (await this.repo.findById(id))?.isActive;
    const updated = await this.repo.update(id, dto as unknown as Partial<Scholarship>);
    if (!updated) throw new DomainException('NOT_FOUND', 'Scholarship not found.', HttpStatus.NOT_FOUND);

    // Fires only on the inactive → active transition, not every edit.
    if (dto.isActive === true && wasActive === false) {
      this.notifyMatchingStudents(updated).catch(err => this.logger.warn(`Scholarship-activated notification fan-out failed: ${(err as Error).message}`));
    }
    return updated;
  }

  listForAdmin(filters: ScholarshipSearchFilters, page: number, limit: number) {
    return this.repo.search(filters, page, limit);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new DomainException('NOT_FOUND', 'Scholarship not found.', HttpStatus.NOT_FOUND);
  }

  /** Admin-triggered "deadline approaching" fan-out for one scholarship. */
  async notifyDeadlineApproaching(id: string): Promise<number> {
    const scholarship = await this.repo.findById(id);
    if (!scholarship) throw new DomainException('NOT_FOUND', 'Scholarship not found.', HttpStatus.NOT_FOUND);

    const students = await this.eligibleStudentsFor(scholarship);
    let sent = 0;
    for (const student of students) {
      const channels = enabledChannelsFor(student);
      if (channels.length === 0) continue;
      await this.notificationService.schedule({
        userId: student.id,
        type: 'scholarship_deadline',
        category: 'scholarships',
        subtype: 'deadline_reminder',
        title: `Deadline approaching: ${scholarship.name}`,
        message: `The application deadline for "${scholarship.name}" is ${scholarship.applicationDeadline.toDateString()}. Don't miss it.`,
        channels: [...channels, 'inApp'],
        relatedScholarshipId: scholarship.id,
      });
      sent++;
    }
    return sent;
  }

  /** Fan-out for a newly created or newly activated scholarship. Bounded
   * to students whose exam profile matches — same "eligible enough to
   * matter" filter the deadline reminder uses, just triggered on publish
   * rather than by an admin action. Goes through the event bus (rather than
   * calling NotificationService directly) so preference gating, email
   * templating, and delivery logging all run through the same pipeline as
   * every other notification trigger. */
  private async notifyMatchingStudents(scholarship: ScholarshipDocument): Promise<void> {
    if (!scholarship.isActive) return;
    const students = await this.eligibleStudentsFor(scholarship);
    if (students.length === 0) return;
    this.events.emit(NOTIFICATION_EVENTS.SCHOLARSHIP_NEW_MATCH, {
      scholarshipId: scholarship.id,
      scholarshipName: scholarship.name,
      userIds: students.map(s => s.id),
    });
  }

  private async eligibleStudentsFor(scholarship: ScholarshipDocument): Promise<UserDocument[]> {
    const exams = scholarship.eligibility.exams?.length ? scholarship.eligibility.exams : ['KCET', 'COMEDK', 'NEET'];
    const byExam = await Promise.all(exams.map(exam => this.userRepo.findByExamCode(exam)));
    const seen = new Map<string, UserDocument>();
    for (const list of byExam) for (const u of list) seen.set(u.id, u);
    return Array.from(seen.values());
  }
}

function enabledChannelsFor(user: { notificationChannels?: { sms?: boolean; email?: boolean; whatsapp?: boolean; push?: boolean }; isEmailVerified?: boolean }): string[] {
  const channels: string[] = [];
  if (user.notificationChannels?.sms) channels.push('sms');
  if (user.notificationChannels?.email && user.isEmailVerified) channels.push('email');
  if (user.notificationChannels?.whatsapp) channels.push('whatsapp');
  if (user.notificationChannels?.push) channels.push('push');
  return channels;
}

function slugify(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    + '-' + Math.random().toString(36).slice(2, 7);
}
