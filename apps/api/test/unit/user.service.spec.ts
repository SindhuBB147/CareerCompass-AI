import { UserService } from '../../src/modules/users/services/user.service';
import { TokenService } from '../../src/modules/auth/services/token.service';
import { DomainException } from '../../src/common/filters/domain.exception';

describe('UserService — onboarding, profile completion, linked accounts', () => {
  let userService: UserService;
  let userRepoMock: any;
  let evtModelMock: any;
  let tokenService: TokenService;
  let configMock: any;

  const baseUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'usr_1',
    fullName: 'Test Student',
    email: 'student@example.com',
    photoUrl: undefined,
    dob: undefined,
    gender: '',
    domicileState: '',
    city: '',
    academic: {},
    examProfiles: [],
    categoryReservation: {},
    preferences: {},
    aiPersonalization: {},
    notificationChannels: { sms: true, email: false, whatsapp: false, push: false },
    linkedAccounts: [],
    passwordHash: 'hash',
    isEmailVerified: false,
    onboarding: { completed: false, currentStep: 1, completedSteps: [] },
    ...overrides,
  });

  beforeEach(() => {
    userRepoMock = {
      findById: jest.fn(),
      saveOnboardingStep: jest.fn(),
      completeOnboarding: jest.fn(),
      findByLinkedAccount: jest.fn().mockResolvedValue(null),
      linkAccount: jest.fn(),
      unlinkAccount: jest.fn(),
      softDelete: jest.fn(),
    };
    evtModelMock = { create: jest.fn(), findOne: jest.fn(), findByIdAndUpdate: jest.fn() };
    configMock = { get: jest.fn(() => null) };
    const jwtServiceMock = new (require('@nestjs/jwt').JwtService)();
    tokenService = new TokenService(jwtServiceMock, configMock as any);

    userService = new UserService(
      userRepoMock, evtModelMock, tokenService, configMock,
      { deliverEmail: jest.fn(), sendTemplate: jest.fn() } as any,
      { emit: jest.fn() } as any,
    );
  });

  describe('onboarding steps', () => {
    it('saves step 1 (personal info) mapping state -> domicileState', async () => {
      userRepoMock.saveOnboardingStep.mockResolvedValue(baseUser());
      await userService.saveStep1('usr_1', { state: 'Karnataka', city: 'Bengaluru' } as any);

      expect(userRepoMock.saveOnboardingStep).toHaveBeenCalledWith(
        'usr_1', 1, expect.objectContaining({ domicileState: 'Karnataka', city: 'Bengaluru' }),
      );
    });

    it('saves step 3 (exams) transforming attemptYear -> year', async () => {
      userRepoMock.saveOnboardingStep.mockResolvedValue(baseUser());
      await userService.saveStep3('usr_1', {
        exams: [{ examCode: 'KCET', rank: 500, attemptYear: 2025 }],
      } as any);

      expect(userRepoMock.saveOnboardingStep).toHaveBeenCalledWith(
        'usr_1', 3,
        { examProfiles: [expect.objectContaining({ examCode: 'KCET', year: 2025, rank: 500, status: 'active' })] },
      );
    });

    it('throws NotFoundException when the user does not exist', async () => {
      userRepoMock.saveOnboardingStep.mockResolvedValue(null);
      await expect(userService.saveStep2('missing', {} as any)).rejects.toThrow();
    });

    it('marks onboarding complete', async () => {
      userRepoMock.completeOnboarding.mockResolvedValue(baseUser({ onboarding: { completed: true } }));
      const result = await userService.completeOnboarding('usr_1');
      expect(result.onboarding.completed).toBe(true);
    });
  });

  describe('getProfileCompletion', () => {
    it('reports 0% for a freshly created account', async () => {
      userRepoMock.findById.mockResolvedValue(baseUser());
      const result = await userService.getProfileCompletion('usr_1');
      expect(result.percent).toBe(0);
      expect(result.checks.length).toBe(8);
    });

    it('increases as fields are filled in', async () => {
      userRepoMock.findById.mockResolvedValue(baseUser({
        photoUrl: 'https://example.com/a.png',
        isEmailVerified: true,
        examProfiles: [{ examCode: 'KCET', year: 2025, rank: 100 }],
      }));
      const result = await userService.getProfileCompletion('usr_1');
      expect(result.percent).toBeGreaterThan(0);
      expect(result.checks.find((c: any) => c.key === 'photo')).toBeUndefined();
      expect(result.checks.find((c: any) => c.key === 'emailVerified')).toBeUndefined();
    });
  });

  describe('linkAccount', () => {
    it('links a new provider to the user', async () => {
      userRepoMock.linkAccount.mockResolvedValue(baseUser({ linkedAccounts: [{ provider: 'google', linkedAt: new Date() }] }));
      const result = await userService.linkAccount('usr_1', { provider: 'google', idTokenTokenOrCode: 'code_123' } as any);
      expect(result).toEqual([{ provider: 'google', linkedAt: expect.any(Date) }]);
    });

    it('rejects linking a provider account already linked to a different user', async () => {
      userRepoMock.findByLinkedAccount.mockResolvedValue({ id: 'usr_other' });
      await expect(userService.linkAccount('usr_1', { provider: 'google', idTokenTokenOrCode: 'code_123' } as any))
        .rejects.toBeInstanceOf(DomainException);
    });
  });

  describe('unlinkAccount', () => {
    it('refuses to unlink the only sign-in method when there is no password', async () => {
      userRepoMock.findById.mockResolvedValue(baseUser({ passwordHash: null, linkedAccounts: [{ provider: 'google' }] }));
      await expect(userService.unlinkAccount('usr_1', 'google')).rejects.toBeInstanceOf(DomainException);
    });

    it('allows unlinking when a password exists', async () => {
      userRepoMock.findById.mockResolvedValue(baseUser({ passwordHash: 'hash', linkedAccounts: [{ provider: 'google' }] }));
      await userService.unlinkAccount('usr_1', 'google');
      expect(userRepoMock.unlinkAccount).toHaveBeenCalledWith('usr_1', 'google');
    });
  });
});
