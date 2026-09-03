import { ScholarshipService } from '../../src/modules/scholarships/services/scholarship.service';
import { ScholarshipRepository } from '../../src/modules/scholarships/repositories/scholarship.repository';
import { ScholarshipBookmarkRepository } from '../../src/modules/scholarships/repositories/scholarship-bookmark.repository';
import { UserRepository } from '../../src/modules/users/repositories/user.repository';
import { NotificationService } from '../../src/modules/notifications/services/notification.service';
import { EligibilityEngineService } from '../../src/modules/scholarships/services/eligibility-engine.service';
import { RecommendationService } from '../../src/modules/scholarships/services/recommendation.service';
import { ScholarshipInteractionService } from '../../src/modules/scholarships/services/scholarship-interaction.service';
import { DomainException } from '../../src/common/filters/domain.exception';

describe('ScholarshipService', () => {
  let repo: jest.Mocked<Pick<ScholarshipRepository, 'listPaginated' | 'delete' | 'create' | 'update' | 'listAll' | 'search' | 'findById' | 'findBySlug' | 'findByExactName' | 'listActive' | 'findByIds'>>;
  let bookmarkRepo: jest.Mocked<Pick<ScholarshipBookmarkRepository, 'add' | 'remove' | 'listForUser'>>;
  let userRepo: jest.Mocked<Pick<UserRepository, 'findById' | 'findByExamCode'>>;
  let notificationService: jest.Mocked<Pick<NotificationService, 'schedule'>>;
  let interactionService: jest.Mocked<Pick<ScholarshipInteractionService, 'record'>>;
  let events: { emit: jest.Mock };
  let service: ScholarshipService;

  beforeEach(() => {
    repo = {
      listPaginated: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      listAll: jest.fn().mockResolvedValue([{ id: 'seed' }]),
      search: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findByExactName: jest.fn().mockResolvedValue(null),
      listActive: jest.fn().mockResolvedValue([]),
      findByIds: jest.fn(),
    };
    bookmarkRepo = { add: jest.fn(), remove: jest.fn(), listForUser: jest.fn().mockResolvedValue([]) };
    userRepo = { findById: jest.fn(), findByExamCode: jest.fn().mockResolvedValue([]) };
    notificationService = { schedule: jest.fn() };
    interactionService = { record: jest.fn().mockResolvedValue(undefined) };
    events = { emit: jest.fn() };

    service = new ScholarshipService(
      repo as unknown as ScholarshipRepository,
      userRepo as unknown as UserRepository,
      bookmarkRepo as unknown as ScholarshipBookmarkRepository,
      new EligibilityEngineService(),
      new RecommendationService(new EligibilityEngineService()),
      notificationService as unknown as NotificationService,
      interactionService as unknown as ScholarshipInteractionService,
      events as any,
    );
  });

  describe('listForAdmin', () => {
    it('delegates filters and pagination to the repository', async () => {
      repo.search.mockResolvedValue({ scholarships: [], totalResults: 0 });
      await service.listForAdmin({ q: 'merit', isActive: true }, 1, 20);
      expect(repo.search).toHaveBeenCalledWith({ q: 'merit', isActive: true }, 1, 20);
    });
  });

  describe('create', () => {
    it('rejects a duplicate scholarship name', async () => {
      repo.findByExactName.mockResolvedValue({ id: 'existing' } as any);
      await expect(service.create({ name: 'Existing Scholarship' } as any)).rejects.toBeInstanceOf(DomainException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates and notifies matching students when active', async () => {
      repo.findByExactName.mockResolvedValue(null);
      const created = { id: 'new_1', name: 'New Scholarship', isActive: true, eligibility: { exams: ['KCET'] }, applicationDeadline: new Date() };
      repo.create.mockResolvedValue(created as any);
      userRepo.findByExamCode.mockResolvedValue([
        { id: 'student_1', notificationChannels: { sms: true }, isEmailVerified: false } as any,
      ]);

      const result = await service.create({ name: 'New Scholarship' } as any);
      expect(result).toBe(created);
      // Fan-out is fire-and-forget (several chained awaits deep); flush the microtask queue.
      for (let i = 0; i < 10; i++) await Promise.resolve();
      expect(events.emit).toHaveBeenCalledWith('scholarship.new_match', expect.objectContaining({ scholarshipId: 'new_1', userIds: ['student_1'] }));
    });
  });

  describe('update', () => {
    it('rejects renaming to a name already used by another scholarship', async () => {
      repo.findByExactName.mockResolvedValue({ id: 'other' } as any);
      await expect(service.update('id_1', { name: 'Taken Name' } as any)).rejects.toBeInstanceOf(DomainException);
    });

    it('throws NOT_FOUND when the scholarship does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      repo.update.mockResolvedValue(null);
      await expect(service.update('missing', { description: 'x' } as any)).rejects.toBeInstanceOf(DomainException);
    });
  });

  describe('delete', () => {
    it('throws NOT_FOUND when nothing was deleted', async () => {
      repo.delete.mockResolvedValue(null);
      await expect(service.delete('missing')).rejects.toThrow(DomainException);
    });

    it('resolves when the scholarship was deleted', async () => {
      repo.delete.mockResolvedValue({ id: 'gone' } as any);
      await expect(service.delete('gone')).resolves.toBeUndefined();
    });
  });

  describe('bookmarks', () => {
    it('adds a bookmark only when the scholarship exists', async () => {
      repo.findBySlug.mockResolvedValue({ id: 's1' } as any);
      await service.addBookmark('u1', 's1');
      expect(bookmarkRepo.add).toHaveBeenCalledWith('u1', 's1');
    });

    it('rejects bookmarking a non-existent scholarship', async () => {
      repo.findBySlug.mockResolvedValue(null);
      await expect(service.addBookmark('u1', 'missing')).rejects.toBeInstanceOf(DomainException);
    });

    it('lists bookmarked scholarships by resolving stored ids', async () => {
      bookmarkRepo.listForUser.mockResolvedValue([{ scholarshipId: 's1' }, { scholarshipId: 's2' }] as any);
      repo.findByIds.mockResolvedValue([{ id: 's1' }, { id: 's2' }] as any);
      const result = await service.listBookmarks('u1');
      expect(repo.findByIds).toHaveBeenCalledWith(['s1', 's2']);
      expect(result).toHaveLength(2);
    });

    it('returns an empty list without querying scholarships when nothing is bookmarked', async () => {
      bookmarkRepo.listForUser.mockResolvedValue([]);
      const result = await service.listBookmarks('u1');
      expect(result).toEqual([]);
      expect(repo.findByIds).not.toHaveBeenCalled();
    });
  });

  describe('checkEligibility', () => {
    it('evaluates the student profile against the scholarship', async () => {
      userRepo.findById.mockResolvedValue({ category: 'SC', examProfiles: [] } as any);
      repo.findBySlug.mockResolvedValue({ eligibility: { categories: ['SC'], exams: [], states: [], applicableCourses: [] } } as any);
      const report = await service.checkEligibility('u1', 's1');
      expect(report.verdict).toBe('eligible');
    });

    it('records an eligibility_checked interaction with the verdict (Scholarship Memory)', async () => {
      userRepo.findById.mockResolvedValue({ category: 'SC', examProfiles: [] } as any);
      repo.findBySlug.mockResolvedValue({ id: 's1', eligibility: { categories: ['SC'], exams: [], states: [], applicableCourses: [] } } as any);
      await service.checkEligibility('u1', 's1');
      expect(interactionService.record).toHaveBeenCalledWith('u1', 's1', 'eligibility_checked', { verdict: 'eligible' });
    });

    it('throws NOT_FOUND when the scholarship does not exist', async () => {
      userRepo.findById.mockResolvedValue({} as any);
      repo.findBySlug.mockResolvedValue(null);
      await expect(service.checkEligibility('u1', 'missing')).rejects.toBeInstanceOf(DomainException);
    });

    it('resolves by ObjectId (not slug) when given a 24-char hex id', async () => {
      userRepo.findById.mockResolvedValue({ category: 'SC', examProfiles: [] } as any);
      repo.findById.mockResolvedValue({ eligibility: { categories: ['SC'], exams: [], states: [], applicableCourses: [] } } as any);
      const objectId = '507f1f77bcf86cd799439011';
      const report = await service.checkEligibility('u1', objectId);
      expect(repo.findById).toHaveBeenCalledWith(objectId);
      expect(repo.findBySlug).not.toHaveBeenCalled();
      expect(report.verdict).toBe('eligible');
    });
  });

  describe('getMatched / countMatchingForProfile (legacy — AI Counsellor & Predictor integration)', () => {
    it('getMatched throws NotFoundException for an unknown user', async () => {
      userRepo.findById.mockResolvedValue(null);
      await expect(service.getMatched('missing')).rejects.toThrow();
    });
  });
});
