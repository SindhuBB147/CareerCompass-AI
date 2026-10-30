import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationService } from './notification.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { AdminUserRepository } from '../../auth/repositories/admin-user.repository';
import { SavedCollege, SavedCollegeDocument } from '../../wishlist/models/saved-college.model';
import {
  NOTIFICATION_EVENTS, ScholarshipNewMatchEvent, RoadmapMilestoneEvent, ExamRoundUpdatedEvent,
  CollegeUpdatedEvent, PredictionImprovedEvent, AuthEvent, UserProfileEvent, UserRegisteredEvent, AdminSystemEvent,
  AccountLockedEvent,
} from '../events/notification.events';

const ADMISSION_EVENT_LABELS: Record<ExamRoundUpdatedEvent['subtype'], string> = {
  registration_open: 'Registration is now open',
  registration_close: 'Registration closes soon',
  document_verification: 'Document verification begins',
  choice_filling_open: 'Choice filling is now open',
  choice_filling_close: 'Choice filling closes soon',
  mock_allotment: 'Mock allotment released',
  round_result: 'Round result released',
  extended_round: 'Extended round announced',
  mopup_round: 'Mop-up round announced',
  spot_round: 'Spot round announced',
  reporting_deadline: 'College reporting deadline',
  fee_payment_deadline: 'Fee payment deadline',
};

const COLLEGE_EVENT_LABELS: Record<CollegeUpdatedEvent['subtype'], string> = {
  cutoff_updated: 'Cutoff ranks updated',
  fee_changed: 'Fee structure updated',
  placement_updated: 'Placement data updated',
  nirf_changed: 'NIRF ranking updated',
  course_added: 'New course added',
  admission_open: 'Admissions are now open',
};

const ACCOUNT_EVENT_COPY: Record<string, { title: string; message: string }> = {
  login: { title: 'New sign-in', message: 'You just signed in to your CareerCompass AI account.' },
  new_device: { title: 'New device sign-in', message: 'Your account was accessed from a device we haven\'t seen before. If this wasn\'t you, reset your password immediately.' },
  password_changed: { title: 'Password changed', message: 'Your account password was just changed.' },
  email_verified: { title: 'Email verified', message: 'Your email address has been verified.' },
};

@Injectable()
export class NotificationEventListenerService {
  private readonly logger = new Logger('NotificationEventListenerService');

  constructor(
    private readonly dispatch: NotificationDispatchService,
    private readonly notificationService: NotificationService,
    private readonly userRepo: UserRepository,
    private readonly adminUserRepo: AdminUserRepository,
    @InjectModel(SavedCollege.name) private readonly savedCollegeModel: Model<SavedCollegeDocument>,
  ) {}

  @OnEvent(NOTIFICATION_EVENTS.SCHOLARSHIP_NEW_MATCH)
  async onScholarshipNewMatch(event: ScholarshipNewMatchEvent): Promise<void> {
    for (const userId of event.userIds) {
      const user = await this.userRepo.findById(userId);
      await this.dispatch.dispatch({
        userId,
        type: 'scholarship_new_match',
        category: 'scholarships',
        priority: 'medium',
        title: `New scholarship match: ${event.scholarshipName}`,
        message: `Based on your profile, you're eligible for "${event.scholarshipName}". Check it out before the deadline.`,
        actionUrl: `/scholarships/${event.scholarshipId}`,
        relatedScholarshipId: event.scholarshipId,
        emailTemplateKey: 'scholarship_reminder',
        emailVariables: {
          name: user?.fullName ?? 'there',
          scholarshipName: event.scholarshipName,
          message: `you're now eligible for this scholarship based on your profile.`,
          ctaUrl: `/scholarships/${event.scholarshipId}`,
        },
      });
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.ROADMAP_MILESTONE_COMPLETED)
  async onMilestoneCompleted(event: RoadmapMilestoneEvent): Promise<void> {
    await this.dispatch.dispatch({
      userId: event.userId,
      type: 'roadmap_milestone',
      subtype: 'completed',
      category: 'roadmap',
      priority: 'low',
      title: `Milestone completed: ${event.milestoneTitle}`,
      message: `Great work — you completed "${event.milestoneTitle}". Keep the momentum going.`,
      actionUrl: '/roadmap',
      relatedRoadmapId: event.roadmapId,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.ROADMAP_MILESTONE_CHECK_IN)
  async onMilestoneCheckIn(event: RoadmapMilestoneEvent & { checkInAt: Date }): Promise<void> {
    const user = await this.userRepo.findById(event.userId);
    await this.dispatch.scheduleFor({
      userId: event.userId,
      type: 'roadmap_milestone',
      subtype: 'check_in',
      category: 'roadmap',
      priority: 'low',
      title: `Checking in: ${event.milestoneTitle}`,
      message: `You started "${event.milestoneTitle}" a little while ago — jump back into your Career Roadmap to update your progress.`,
      actionUrl: '/roadmap',
      relatedRoadmapId: event.roadmapId,
      emailTemplateKey: 'roadmap_reminder',
      emailVariables: {
        name: user?.fullName ?? 'there',
        milestoneTitle: event.milestoneTitle,
        message: `you started "${event.milestoneTitle}" a little while ago — jump back in to keep your progress moving.`,
        ctaUrl: '/roadmap',
      },
    }, event.checkInAt);
  }

  @OnEvent(NOTIFICATION_EVENTS.EXAM_ROUND_UPDATED)
  async onExamRoundUpdated(event: ExamRoundUpdatedEvent): Promise<void> {
    const users = await this.userRepo.findByExamCode(event.examCode);
    const label = ADMISSION_EVENT_LABELS[event.subtype];
    for (const user of users) {
      await this.dispatch.dispatch({
        userId: user.id,
        type: 'admission_event',
        subtype: event.subtype,
        category: 'admissions',
        priority: event.subtype === 'reporting_deadline' || event.subtype === 'fee_payment_deadline' ? 'high' : 'medium',
        title: `${event.examCode}: ${label}`,
        message: `${label} for ${event.examCode}${event.roundName ? ` ${event.roundName}` : ` Round ${event.roundNumber}`} — ${event.eventDate.toLocaleDateString('en-IN')}.`,
        actionUrl: '/colleges',
        relatedExamCode: event.examCode,
        emailTemplateKey: 'admission_reminder',
        emailVariables: {
          name: user.fullName,
          examCode: event.examCode,
          eventLabel: label,
          eventDate: event.eventDate.toLocaleDateString('en-IN'),
          ctaUrl: '/colleges',
        },
      });
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.COLLEGE_UPDATED)
  async onCollegeUpdated(event: CollegeUpdatedEvent): Promise<void> {
    // Audience = students who bookmarked this college via the Saved
    // Colleges & Wishlist module (SavedCollege — the real "the student
    // cares about this college" signal), unioned with the older
    // `preferences.preferredColleges` onboarding field for students who
    // set that but haven't saved anything yet.
    const [preferredUsers, savedUserIds] = await Promise.all([
      this.userRepo.findByPreferredCollege(event.collegeId),
      this.savedCollegeModel.distinct('userId', { collegeId: event.collegeId }).exec() as Promise<string[]>,
    ]);
    const extraSavedUsers = (await Promise.all(
      savedUserIds
        .filter(id => !preferredUsers.some(u => u.id === id))
        .map(id => this.userRepo.findById(id)),
    )).filter((u): u is NonNullable<typeof u> => u != null);
    const users = [...preferredUsers, ...extraSavedUsers];

    const label = COLLEGE_EVENT_LABELS[event.subtype];
    for (const user of users) {
      await this.dispatch.dispatch({
        userId: user.id,
        type: 'college_update',
        subtype: event.subtype,
        category: 'admissions',
        priority: 'medium',
        title: `${event.collegeName}: ${label}`,
        message: event.summary,
        actionUrl: `/colleges/${event.collegeId}`,
        relatedCollegeId: event.collegeId,
      });
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.PREDICTION_IMPROVED)
  async onPredictionImproved(event: PredictionImprovedEvent): Promise<void> {
    await this.dispatch.dispatch({
      userId: event.userId,
      type: 'ai_suggestion',
      subtype: 'admission_chance_improved',
      category: 'ai_suggestions',
      priority: 'medium',
      title: 'Your admission chances have improved',
      message: `A better match is now available: ${event.courseName} at ${event.collegeName} for your ${event.examCode} rank.`,
      actionUrl: '/predictions',
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.AUTH_NEW_DEVICE)
  async onNewDeviceLogin(event: AuthEvent): Promise<void> {
    await this.emitAccountEvent(event.userId, 'new_device');
  }

  @OnEvent(NOTIFICATION_EVENTS.AUTH_PASSWORD_CHANGED)
  async onPasswordChanged(event: AuthEvent): Promise<void> {
    await this.emitAccountEvent(event.userId, 'password_changed');
  }

  @OnEvent(NOTIFICATION_EVENTS.AUTH_EMAIL_VERIFIED)
  async onEmailVerified(event: AuthEvent): Promise<void> {
    await this.emitAccountEvent(event.userId, 'email_verified');
  }

  @OnEvent(NOTIFICATION_EVENTS.AUTH_2FA_ENABLED)
  async on2faEnabled(event: AuthEvent): Promise<void> {
    const user = await this.userRepo.findById(event.userId);
    await this.dispatch.dispatch({
      userId: event.userId, type: 'account_activity', subtype: '2fa_enabled', category: 'account', priority: 'high',
      title: 'Two-factor authentication enabled', message: 'Two-factor authentication was just turned on for your account.',
      emailTemplateKey: 'security_2fa_enabled', emailVariables: { name: user?.fullName ?? 'there' },
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.AUTH_2FA_DISABLED)
  async on2faDisabled(event: AuthEvent): Promise<void> {
    const user = await this.userRepo.findById(event.userId);
    await this.dispatch.dispatch({
      userId: event.userId, type: 'account_activity', subtype: '2fa_disabled', category: 'account', priority: 'high',
      title: 'Two-factor authentication disabled', message: 'Two-factor authentication was just turned off for your account.',
      emailTemplateKey: 'security_2fa_disabled', emailVariables: { name: user?.fullName ?? 'there' },
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.AUTH_SUSPICIOUS_LOGIN)
  async onSuspiciousLogin(event: AuthEvent): Promise<void> {
    const user = await this.userRepo.findById(event.userId);
    await this.dispatch.dispatch({
      userId: event.userId, type: 'account_activity', subtype: 'suspicious_login', category: 'account', priority: 'high',
      title: 'Unusual sign-in activity', message: 'We noticed repeated failed sign-in attempts on your account.',
      emailTemplateKey: 'security_suspicious_login',
      emailVariables: { name: user?.fullName ?? 'there', device: event.userAgent ?? 'an unknown device', ip: event.ip ?? 'an unknown IP', time: new Date().toLocaleString('en-IN') },
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.AUTH_ACCOUNT_LOCKED)
  async onAccountLocked(event: AccountLockedEvent): Promise<void> {
    const user = await this.userRepo.findById(event.userId);
    await this.dispatch.dispatch({
      userId: event.userId, type: 'account_activity', subtype: 'account_locked', category: 'account', priority: 'high',
      title: 'Account temporarily locked', message: `Your account was locked for ${event.minutes} minutes after too many failed sign-in attempts.`,
      emailTemplateKey: 'security_account_locked', emailVariables: { name: user?.fullName ?? 'there', minutes: String(event.minutes) },
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.AUTH_LINKED_ACCOUNT_REMOVED)
  async onLinkedAccountRemoved(event: UserProfileEvent): Promise<void> {
    await this.dispatch.dispatch({
      userId: event.userId, type: 'account_activity', subtype: 'linked_account_removed', category: 'account', priority: 'low',
      title: 'Account unlinked', message: event.summary,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.USER_PROFILE_UPDATED)
  async onProfileUpdated(event: UserProfileEvent): Promise<void> {
    await this.dispatch.dispatch({
      userId: event.userId,
      type: 'account_activity',
      subtype: 'profile_updated',
      category: 'account',
      priority: 'low',
      title: 'Profile updated',
      message: event.summary,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.USER_LINKED_ACCOUNT_ADDED)
  async onLinkedAccountAdded(event: UserProfileEvent): Promise<void> {
    await this.dispatch.dispatch({
      userId: event.userId,
      type: 'account_activity',
      subtype: 'linked_account_added',
      category: 'account',
      priority: 'low',
      title: 'Account linked',
      message: event.summary,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.USER_REGISTERED)
  async onUserRegistered(event: UserRegisteredEvent): Promise<void> {
    await this.dispatch.dispatch({
      userId: event.userId,
      type: 'account_activity',
      subtype: 'welcome',
      category: 'account',
      priority: 'low',
      title: `Welcome to CareerCompass AI, ${event.fullName}`,
      message: 'Your account is ready. Complete your profile to unlock personalized predictions, scholarships, and a career roadmap.',
      actionUrl: '/onboarding',
      emailTemplateKey: 'welcome',
      emailVariables: { name: event.fullName, ctaUrl: '/onboarding' },
    });
    await this.onAdminSystemEvent({ subtype: 'new_registration', message: `New student registered: ${event.fullName}.` });
  }

  @OnEvent(NOTIFICATION_EVENTS.ADMIN_SYSTEM_EVENT)
  async onAdminSystemEvent(event: AdminSystemEvent): Promise<void> {
    // Admins live in a separate collection with no NotificationPreference
    // record — bypass the student-oriented preference gate and write
    // in-app system alerts directly for the target admin(s).
    let targetIds = event.adminUserIds;
    if (!targetIds?.length) {
      const { admins } = await this.adminUserRepo.list({ role: 'super_admin' }, 1, 500);
      targetIds = admins.map(a => a.id);
    }
    for (const adminId of targetIds) {
      await this.notificationService.schedule({
        userId: adminId,
        type: 'admin_alert',
        subtype: event.subtype,
        category: 'system',
        priority: event.subtype === 'ai_service_error' || event.subtype === 'prediction_failure' || event.subtype === 'dataset_update_failed' ? 'high' : 'medium',
        title: this.adminEventTitle(event.subtype),
        message: event.message,
        channels: ['inApp'],
      });
    }
  }

  private async emitAccountEvent(userId: string, key: keyof typeof ACCOUNT_EVENT_COPY): Promise<void> {
    const copy = ACCOUNT_EVENT_COPY[key];
    await this.dispatch.dispatch({
      userId,
      type: 'account_activity',
      subtype: key,
      category: 'account',
      priority: key === 'new_device' || key === 'password_changed' ? 'high' : 'low',
      title: copy.title,
      message: copy.message,
    });
  }

  private adminEventTitle(subtype: AdminSystemEvent['subtype']): string {
    const titles: Record<AdminSystemEvent['subtype'], string> = {
      new_registration: 'New student registration',
      bulk_import_completed: 'Bulk import completed',
      dataset_update_failed: 'Dataset update failed',
      ai_service_error: 'AI service error',
      prediction_failure: 'Prediction failure',
      backup_completed: 'Backup completed',
      system_alert: 'System alert',
    };
    return titles[subtype];
  }
}
