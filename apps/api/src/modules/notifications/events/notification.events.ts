// Domain event names + payloads emitted by feature modules via EventEmitter2
// and consumed by NotificationEventListenerService. Feature modules only
// depend on EventEmitter2 (global), never on NotificationsModule — keeps the
// dependency graph one-directional (notifications -> everything, nothing ->
// notifications) and avoids circular Nest module imports.

export const NOTIFICATION_EVENTS = {
  SCHOLARSHIP_NEW_MATCH: 'scholarship.new_match',
  ROADMAP_MILESTONE_COMPLETED: 'roadmap.milestone.completed',
  ROADMAP_MILESTONE_CHECK_IN: 'roadmap.milestone.check_in',
  EXAM_ROUND_UPDATED: 'exam.round.updated',
  COLLEGE_UPDATED: 'college.updated',
  PREDICTION_IMPROVED: 'prediction.improved',
  AUTH_LOGIN: 'auth.login',
  AUTH_NEW_DEVICE: 'auth.new_device_login',
  AUTH_PASSWORD_CHANGED: 'auth.password_changed',
  AUTH_EMAIL_VERIFIED: 'auth.email_verified',
  AUTH_2FA_ENABLED: 'auth.2fa_enabled',
  AUTH_2FA_DISABLED: 'auth.2fa_disabled',
  AUTH_SUSPICIOUS_LOGIN: 'auth.suspicious_login',
  AUTH_ACCOUNT_LOCKED: 'auth.account_locked',
  AUTH_LINKED_ACCOUNT_REMOVED: 'auth.linked_account_removed',
  USER_PROFILE_UPDATED: 'user.profile_updated',
  USER_LINKED_ACCOUNT_ADDED: 'user.linked_account_added',
  USER_REGISTERED: 'user.registered',
  ADMIN_SYSTEM_EVENT: 'admin.system_event',
} as const;

export interface ScholarshipNewMatchEvent {
  scholarshipId: string;
  scholarshipName: string;
  userIds: string[];
}

export interface RoadmapMilestoneEvent {
  userId: string;
  milestoneKey: string;
  milestoneTitle: string;
  roadmapId?: string;
}

export interface ExamRoundUpdatedEvent {
  examCode: string;
  examYear: number;
  roundNumber: number;
  roundName?: string;
  subtype: 'registration_open' | 'registration_close' | 'document_verification' | 'choice_filling_open'
    | 'choice_filling_close' | 'mock_allotment' | 'round_result' | 'extended_round' | 'mopup_round'
    | 'spot_round' | 'reporting_deadline' | 'fee_payment_deadline';
  eventDate: Date;
}

export interface CollegeUpdatedEvent {
  collegeId: string;
  collegeName: string;
  subtype: 'cutoff_updated' | 'fee_changed' | 'placement_updated' | 'nirf_changed' | 'course_added' | 'admission_open';
  summary: string;
}

export interface PredictionImprovedEvent {
  userId: string;
  collegeName: string;
  courseName: string;
  examCode: string;
}

export interface AuthEvent {
  userId: string;
  ip?: string;
  userAgent?: string;
}

export interface AccountLockedEvent {
  userId: string;
  minutes: number;
}

export interface UserProfileEvent {
  userId: string;
  summary: string;
}

export interface UserRegisteredEvent {
  userId: string;
  fullName: string;
}

export interface AdminSystemEvent {
  subtype: 'new_registration' | 'bulk_import_completed' | 'dataset_update_failed' | 'ai_service_error'
    | 'prediction_failure' | 'backup_completed' | 'system_alert';
  message: string;
  adminUserIds?: string[]; // if omitted, all super_admins are notified
}
