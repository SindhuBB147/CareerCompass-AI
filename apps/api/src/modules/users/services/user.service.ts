import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailerService } from '../../../common/mailer/mailer.service';
import { NOTIFICATION_EVENTS } from '../../notifications/events/notification.events';
import { UserRepository } from '../repositories/user.repository';
import { UserDocument, SUPPORTED_EXAM_CODES, LinkedAccountProvider } from '../models/user.model';
import { TokenService } from '../../auth/services/token.service';
import { minutesFromNow } from '../../../common/utils/date.util';
import { DomainException } from '../../../common/filters/domain.exception';
import { HttpStatus } from '@nestjs/common';
import {
  AddExamProfileDto, UpdateExamProfileDto, UpdateProfileDto,
  UpdateNotificationPreferencesDto, OnboardingStep1Dto, OnboardingStep2Dto,
  OnboardingStep3Dto, OnboardingStep4Dto, OnboardingStep5Dto, OnboardingStep6Dto,
  LinkAccountDto,
} from '../dto/user.dto';
import {
  EmailVerificationToken,
  EmailVerificationTokenDocument,
} from '../models/email-verification-token.model';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    @InjectModel(EmailVerificationToken.name)
    private readonly evtModel: Model<EmailVerificationTokenDocument>,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
    private readonly events: EventEmitter2,
  ) {}

  async getProfile(userId: string): Promise<UserDocument> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDocument> {
    const fields: Record<string, unknown> = {};
    if (dto.fullName !== undefined) fields.fullName = dto.fullName;
    if (dto.category !== undefined) fields.category = dto.category;
    if (dto.domicileState !== undefined) fields.domicileState = dto.domicileState;
    if (dto.familyIncomeAnnual !== undefined) fields.familyIncomeAnnual = dto.familyIncomeAnnual;
    if (dto.preferredTheme !== undefined) fields.preferredTheme = dto.preferredTheme;
    if (dto.preferredLanguage !== undefined) fields.preferredLanguage = dto.preferredLanguage;
    if (dto.currentCollege !== undefined) fields['academic.currentCollege'] = dto.currentCollege;
    if (dto.budgetMax !== undefined || dto.riskAppetite !== undefined) {
      if (dto.budgetMax !== undefined) fields['preferences.budgetMax'] = dto.budgetMax;
      if (dto.riskAppetite !== undefined) fields['preferences.riskAppetite'] = dto.riskAppetite;
    }

    const updated = await this.userRepo.updateProfile(userId, fields as any);
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });
    if (Object.keys(fields).length > 0) {
      this.events.emit(NOTIFICATION_EVENTS.USER_PROFILE_UPDATED, { userId, summary: 'Your profile details were updated.' });
    }
    return updated;
  }

  async addExamProfile(userId: string, dto: AddExamProfileDto): Promise<UserDocument> {
    const code = dto.examCode.toUpperCase();
    if (!SUPPORTED_EXAM_CODES.includes(code as any)) {
      throw new DomainException('UNPROCESSABLE', `"${code}" is not a supported exam. Supported: ${SUPPORTED_EXAM_CODES.join(', ')}`, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const updated = await this.userRepo.addExamProfileIfNotExists(userId, {
      examCode: code, year: dto.year, rank: dto.rank, categoryUsed: dto.categoryUsed, status: 'active',
    });

    if (!updated) {
      const user = await this.userRepo.findById(userId);
      if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });
      throw new DomainException('CONFLICT', `An exam profile for ${code} already exists.`, HttpStatus.CONFLICT);
    }
    return updated;
  }

  async updateExamProfile(userId: string, examCode: string, dto: UpdateExamProfileDto): Promise<UserDocument> {
    const code = examCode.toUpperCase();
    const updated = await this.userRepo.updateExamProfile(userId, code, dto);
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: `No exam profile found for ${code}.` });
    return updated;
  }

  async removeExamProfile(userId: string, examCode: string): Promise<void> {
    await this.userRepo.removeExamProfile(userId, examCode.toUpperCase());
  }

  async updateNotificationPreferences(userId: string, dto: UpdateNotificationPreferencesDto): Promise<UserDocument> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });

    const merged = { ...user.notificationChannels, ...dto };
    if (!merged.sms && !merged.email && !merged.whatsapp && !merged.push) {
      throw new DomainException('UNPROCESSABLE', 'At least one notification channel must remain enabled.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const updated = await this.userRepo.updateNotificationChannels(userId, dto);
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });
    return updated;
  }

  async requestEmailVerification(userId: string, email: string): Promise<void> {
    await this.userRepo.markEmailPending(userId, email);
    const { rawToken, hash } = this.tokenService.generateOpaqueToken();
    const expiryMins = this.config.get<number>('EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES') ?? 1440;
    await this.evtModel.create({ userId, email, tokenHash: hash, expiresAt: minutesFromNow(expiryMins), used: false });
    await this.sendVerificationEmail(email, rawToken, expiryMins);
  }

  async confirmEmailVerification(userId: string, rawToken: string): Promise<void> {
    const hash = this.tokenService.hashToken(rawToken);
    const record = await this.evtModel.findOne({ userId, tokenHash: hash, used: false, expiresAt: { $gt: new Date() } });
    if (!record) throw new DomainException('UNPROCESSABLE', 'This verification code is invalid or has expired.', HttpStatus.UNPROCESSABLE_ENTITY);

    await this.evtModel.findByIdAndUpdate(record.id, { used: true });
    await this.userRepo.markEmailVerified(userId);
    this.events.emit(NOTIFICATION_EVENTS.AUTH_EMAIL_VERIFIED, { userId });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Onboarding wizard
  // ═══════════════════════════════════════════════════════════════════════

  async getOnboarding(userId: string) {
    const user = await this.getProfile(userId);
    return {
      onboarding: user.onboarding,
      personal: {
        photoUrl: user.photoUrl, fullName: user.fullName, gender: user.gender, dob: user.dob,
        phone: user.phone, email: user.email, state: user.domicileState, district: user.district,
        city: user.city, pinCode: user.pinCode, preferredLanguage: user.preferredLanguage,
      },
      academic: user.academic,
      exams: user.examProfiles,
      categoryReservation: user.categoryReservation,
      preferences: user.preferences,
      aiPersonalization: user.aiPersonalization,
    };
  }

  async saveStep1(userId: string, dto: OnboardingStep1Dto): Promise<UserDocument> {
    const fields: Record<string, unknown> = {};
    if (dto.photoUrl !== undefined) fields.photoUrl = dto.photoUrl;
    if (dto.fullName !== undefined) fields.fullName = dto.fullName;
    if (dto.gender !== undefined) fields.gender = dto.gender;
    if (dto.dob !== undefined) fields.dob = new Date(dto.dob);
    if (dto.phone !== undefined) fields.phone = dto.phone;
    if (dto.state !== undefined) fields.domicileState = dto.state;
    if (dto.district !== undefined) fields.district = dto.district;
    if (dto.city !== undefined) fields.city = dto.city;
    if (dto.pinCode !== undefined) fields.pinCode = dto.pinCode;
    if (dto.preferredLanguage !== undefined) fields.preferredLanguage = dto.preferredLanguage;
    return this.saveStep(userId, 1, fields);
  }

  async saveStep2(userId: string, dto: OnboardingStep2Dto): Promise<UserDocument> {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) if (v !== undefined) fields[`academic.${k}`] = v;
    return this.saveStep(userId, 2, fields);
  }

  async saveStep3(userId: string, dto: OnboardingStep3Dto): Promise<UserDocument> {
    const examProfiles = dto.exams.map(e => ({
      examCode: e.examCode,
      year: e.attemptYear,
      rank: e.rank ?? 0,
      categoryRank: e.categoryRank,
      percentile: e.percentile,
      status: 'active' as const,
    }));
    return this.saveStep(userId, 3, { examProfiles });
  }

  async saveStep4(userId: string, dto: OnboardingStep4Dto): Promise<UserDocument> {
    const fields: Record<string, unknown> = {};
    if (dto.reservationCategory !== undefined) fields['categoryReservation.reservationCategory'] = dto.reservationCategory;
    if (dto.horizontalReservations !== undefined) fields['categoryReservation.horizontalReservations'] = dto.horizontalReservations;
    return this.saveStep(userId, 4, fields);
  }

  async saveStep5(userId: string, dto: OnboardingStep5Dto): Promise<UserDocument> {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) if (v !== undefined) fields[`preferences.${k}`] = v;
    return this.saveStep(userId, 5, fields);
  }

  async saveStep6(userId: string, dto: OnboardingStep6Dto): Promise<UserDocument> {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) if (v !== undefined) fields[`aiPersonalization.${k}`] = v;
    return this.saveStep(userId, 6, fields);
  }

  async completeOnboarding(userId: string): Promise<UserDocument> {
    const updated = await this.userRepo.completeOnboarding(userId);
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });
    return updated;
  }

  private async saveStep(userId: string, step: number, fields: Record<string, unknown>): Promise<UserDocument> {
    const updated = await this.userRepo.saveOnboardingStep(userId, step, fields);
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Profile not found.' });
    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Profile completion & dashboard
  // ═══════════════════════════════════════════════════════════════════════

  async getProfileCompletion(userId: string) {
    const user = await this.getProfile(userId);
    const checks: Array<{ key: string; label: string; done: boolean }> = [
      { key: 'photo', label: 'Add a profile photo', done: !!user.photoUrl },
      { key: 'personal', label: 'Complete personal information', done: !!(user.dob && user.gender && user.domicileState && user.city) },
      { key: 'academic', label: 'Add academic information', done: !!(user.academic?.currentQualification && user.academic?.twelfthPercentage) },
      { key: 'exams', label: 'Add at least one entrance exam', done: user.examProfiles.length > 0 },
      { key: 'category', label: 'Set category & reservation details', done: !!user.categoryReservation?.reservationCategory },
      { key: 'preferences', label: 'Set career preferences', done: (user.preferences?.preferredCourses?.length ?? 0) > 0 },
      { key: 'aiPersonalization', label: 'Complete AI personalization', done: !!(user.aiPersonalization?.careerGoal && (user.aiPersonalization?.skills?.length ?? 0) > 0) },
      { key: 'emailVerified', label: 'Verify your email address', done: user.isEmailVerified },
    ];
    const done = checks.filter(c => c.done).length;
    const percent = Math.round((done / checks.length) * 100);
    return { percent, checks: checks.filter(c => !c.done), totalSteps: checks.length, completedSteps: done };
  }

  async getDashboardSummary(userId: string) {
    const user = await this.getProfile(userId);
    const completion = await this.getProfileCompletion(userId);
    const aiFieldsFilled = [
      user.aiPersonalization?.careerGoal,
      user.aiPersonalization?.skills?.length,
      user.aiPersonalization?.interestAreas?.length,
      user.aiPersonalization?.learningStyle,
    ].filter(Boolean).length;

    return {
      profile: {
        name: user.fullName,
        email: user.email,
        photoUrl: user.photoUrl,
        isEmailVerified: user.isEmailVerified,
        memberSince: (user as any).createdAt,
      },
      profileCompletionPercent: completion.percent,
      aiReadinessScore: Math.round((aiFieldsFilled / 4) * 100),
      examsCount: user.examProfiles.length,
      savedCollegesCount: 0,
      predictionsCount: 0,
      scholarshipsEligibleCount: 0,
      careerRoadmapProgressPercent: 0,
      onboarding: user.onboarding,
      linkedAccounts: user.linkedAccounts.map(a => ({ provider: a.provider, linkedAt: a.linkedAt })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Linked accounts & account deletion
  // ═══════════════════════════════════════════════════════════════════════

  async listLinkedAccounts(userId: string) {
    const user = await this.getProfile(userId);
    return user.linkedAccounts.map(a => ({ provider: a.provider, email: a.email, linkedAt: a.linkedAt }));
  }

  async linkAccount(userId: string, dto: LinkAccountDto) {
    const provider = dto.provider as LinkedAccountProvider;
    const providerId = dto.providerId || dto.idTokenTokenOrCode;

    const conflictUser = await this.userRepo.findByLinkedAccount(provider, providerId);
    if (conflictUser && conflictUser.id !== userId) {
      throw new DomainException('CONFLICT', `This ${provider} account is already linked to a different CareerCompass AI account.`, HttpStatus.CONFLICT);
    }

    const updated = await this.userRepo.linkAccount(userId, { provider, providerId, email: dto.email });
    if (!updated) throw new DomainException('CONFLICT', `${provider} is already linked to your account.`, HttpStatus.CONFLICT);
    this.events.emit(NOTIFICATION_EVENTS.USER_LINKED_ACCOUNT_ADDED, { userId, summary: `Your account was linked to ${provider}.` });
    return updated.linkedAccounts;
  }

  async unlinkAccount(userId: string, provider: LinkedAccountProvider): Promise<void> {
    const user = await this.getProfile(userId);
    const hasPassword = !!user.passwordHash;
    const remainingLinks = user.linkedAccounts.filter(a => a.provider !== provider).length;
    if (!hasPassword && remainingLinks === 0) {
      throw new DomainException('UNPROCESSABLE', 'You must set a password or keep at least one linked account to sign in.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    await this.userRepo.unlinkAccount(userId, provider);
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.userRepo.softDelete(userId);
  }

  private async sendVerificationEmail(to: string, rawToken: string, expiryMins: number): Promise<void> {
    await this.mailer.sendTemplate(to, 'verification', { code: rawToken, expiryHours: String(expiryMins / 60) });
  }
}
