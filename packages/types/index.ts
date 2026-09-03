export interface College {
  id: string;
  name: string;
  code: string;
  state: string;
  city: string;
  ownership: 'Government' | 'Private' | 'Aided' | 'Autonomous';
  accreditation?: {
    nirfRank?: number;
    naacGrade?: string;
  };
  courses: Course[];
  placementSummary?: PlacementEntry[];
  isVerified: boolean;
}

export interface Course {
  courseId: string;
  name: string;
  degreeType: string;
  intake: number;
  examsAccepted: string[];
  feePerYear?: number;
}

export interface PlacementEntry {
  year: number;
  placementPercentage: number;
  medianPackage: number;
  topRecruiters?: string[];
}

export interface CutoffTrend {
  year: number;
  round: number;
  openingRank?: number;
  closingRank: number;
}

export interface PredictionResult {
  collegeId: string;
  courseId: string;
  examCode: string;
  probabilityBand: 'Safe' | 'Moderate' | 'Ambitious' | 'Reach';
  probabilityPercent: number;
  rationale: {
    trendingClosingRank: number;
    studentRank: number;
    confidenceLevel: 'high' | 'medium' | 'low';
  };
}

export interface Scholarship {
  id: string;
  name: string;
  provider: 'government' | 'private' | 'institution';
  description?: string;
  eligibility: {
    categories?: string[];
    maxIncome?: number;
    states?: string[];
    exams?: string[];
    genderSpecific?: string;
    minRank?: number;
    maxRank?: number;
  };
  awardAmount: {
    type: 'fixed' | 'percentage';
    value: number;
  };
  applicationDeadline: string;
  applicationLink?: string;
  isActive: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sourcesCited?: string[];
  timestamp: string;
}

export interface AiConversation {
  sessionId: string;
  messages: ChatMessage[];
  startedAt: string;
  status: 'active' | 'closed' | 'escalated';
}

export type NotificationCategory =
  | 'admissions' | 'scholarships' | 'roadmap' | 'financial' | 'ai_suggestions' | 'account' | 'system' | 'announcements';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  subtype?: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  actionUrl?: string;
  icon?: string;
  channels: string[];
  status: 'pending' | 'sent' | 'failed' | 'read';
  isRead: boolean;
  readAt?: string;
  isArchived: boolean;
  isFavorite: boolean;
  createdAt: string;
}

export interface NotificationPreference {
  userId: string;
  channels: {
    inApp: boolean;
    email: boolean;
    browser: boolean;
    sms: boolean;
    whatsapp: boolean;
    push: boolean;
  };
  categories: Record<NotificationCategory, boolean>;
  weeklySummary: boolean;
  marketingEmails: boolean;
}

export type ReminderType = 'counselling' | 'scholarship_deadline' | 'roadmap_task' | 'exam' | 'document_submission' | 'loan_payment' | 'custom';

export interface Reminder {
  id: string;
  userId: string;
  type: ReminderType;
  title: string;
  note?: string;
  remindAt: string;
  relatedEntityId?: string;
  status: 'pending' | 'fired' | 'cancelled';
}
