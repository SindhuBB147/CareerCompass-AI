// Typed client for the Notification module — Notification Center list/filter,
// preferences, reminders, and the admin broadcast/template/delivery-status
// tools. Mirrors lib/scholarships-api.ts's conventions on the shared apiClient.

import { apiClient } from './api-client';

export type NotificationCategory =
  | 'admissions' | 'scholarships' | 'roadmap' | 'financial' | 'ai_suggestions' | 'account' | 'system' | 'announcements';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface NotificationItem {
  id: string;
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

export interface NotificationListFilters {
  category?: NotificationCategory;
  priority?: NotificationPriority;
  isRead?: boolean;
  isFavorite?: boolean;
  isArchived?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface NotificationPreference {
  userId: string;
  channels: { inApp: boolean; email: boolean; browser: boolean; sms: boolean; whatsapp: boolean; push: boolean };
  categories: Record<NotificationCategory, boolean>;
  weeklySummary: boolean;
  marketingEmails: boolean;
}

export type ReminderType = 'counselling' | 'scholarship_deadline' | 'roadmap_task' | 'exam' | 'document_submission' | 'loan_payment' | 'custom';

export interface Reminder {
  id: string;
  type: ReminderType;
  title: string;
  note?: string;
  remindAt: string;
  relatedEntityId?: string;
  status: 'pending' | 'fired' | 'cancelled';
}

function qs(filters: object): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== '') params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const notificationsApi = {
  list: (filters: NotificationListFilters, token: string | null) =>
    apiClient.get<{ notifications: NotificationItem[]; total: number }>(`/notifications${qs(filters)}`, token),
  unreadCount: (token: string | null) => apiClient.get<{ count: number }>('/notifications/unread-count', token),
  markRead: (id: string, token: string | null) => apiClient.patch(`/notifications/${id}/read`, undefined, token),
  markAllRead: (token: string | null) => apiClient.patch<{ updated: number }>('/notifications/read-all', undefined, token),
  archive: (id: string, isArchived: boolean, token: string | null) => apiClient.patch(`/notifications/${id}/archive`, { isArchived }, token),
  favorite: (id: string, isFavorite: boolean, token: string | null) => apiClient.patch(`/notifications/${id}/favorite`, { isFavorite }, token),
  remove: (id: string, token: string | null) => apiClient.del(`/notifications/${id}`, token),

  getPreferences: (token: string | null) => apiClient.get<NotificationPreference>('/notifications/preferences', token),
  updatePreferences: (patch: {
    channels?: Partial<NotificationPreference['channels']>;
    categories?: Partial<NotificationPreference['categories']>;
    weeklySummary?: boolean;
    marketingEmails?: boolean;
  }, token: string | null) => apiClient.patch<NotificationPreference>('/notifications/preferences', patch, token),

  listReminders: (token: string | null) => apiClient.get<Reminder[]>('/notifications/reminders', token),
  createReminder: (input: { type: ReminderType; title: string; remindAt: string; note?: string; relatedEntityId?: string }, token: string | null) =>
    apiClient.post<Reminder>('/notifications/reminders', input, token),
  cancelReminder: (id: string, token: string | null) => apiClient.del(`/notifications/reminders/${id}`, token),
};

// ── Admin ──────────────────────────────────────────────────────────────────

export interface EmailTemplateSummary {
  key: string; name: string; subject: string; htmlBody: string; category?: string; isActive: boolean; isOverridden: boolean;
}

export interface DeliveryLogEntry {
  id: string; notificationId: string; userId: string; channel: string; status: 'sent' | 'failed' | 'skipped'; error?: string; attemptedAt: string;
}

export const adminNotificationsApi = {
  broadcast: (input: { title: string; message: string; category?: NotificationCategory; priority?: NotificationPriority; actionUrl?: string }, token: string | null) =>
    apiClient.post<{ recipients: number }>('/admin/notifications/broadcast', input, token),
  targeted: (input: { userIds: string[]; title: string; message: string; category?: NotificationCategory; priority?: NotificationPriority }, token: string | null) =>
    apiClient.post<{ recipients: number }>('/admin/notifications/targeted', input, token),
  announcement: (input: { title: string; message: string; priority?: NotificationPriority }, token: string | null) =>
    apiClient.post<{ recipients: number }>('/admin/notifications/announcement', input, token),
  listTemplates: (token: string | null) => apiClient.get<EmailTemplateSummary[]>('/admin/notifications/templates', token),
  upsertTemplate: (key: string, patch: Partial<Pick<EmailTemplateSummary, 'name' | 'subject' | 'htmlBody' | 'category' | 'isActive'>>, token: string | null) =>
    apiClient.patch<EmailTemplateSummary>(`/admin/notifications/templates/${key}`, patch, token),
  resetTemplate: (key: string, token: string | null) => apiClient.post(`/admin/notifications/templates/${key}/reset`, undefined, token),
  deliveryStatus: (filters: { status?: string; channel?: string; page?: number; limit?: number }, token: string | null) =>
    apiClient.get<{ logs: DeliveryLogEntry[]; total: number }>(`/admin/notifications/delivery-status${qs(filters)}`, token),
};
