import { apiRequest } from '../utils/api';

export type NotificationType =
  | 'inquiry_new'
  | 'site_visit_new'
  | 'inquiry_responded'
  | 'inquiry_closed'
  | 'site_visit_scheduled'
  | 'site_visit_completed'
  | 'site_visit_responded';

export interface AppNotification {
  _id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId: string;
  relatedModel: 'Inquiry' | 'SiteVisit';
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getNotifications(): Promise<AppNotification[]> {
  const response = await apiRequest('/notifications') as ApiEnvelope<AppNotification[]>;
  return response.data ?? [];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const response = await apiRequest('/notifications/unread-count') as ApiEnvelope<{ count: number }>;
  return response.data?.count ?? 0;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const response = await apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }) as ApiEnvelope<AppNotification>;
  return response.data;
}

export async function markAllNotificationsRead(): Promise<{ updatedCount: number }> {
  const response = await apiRequest('/notifications/read-all', { method: 'PATCH' }) as ApiEnvelope<{ updatedCount: number }>;
  return response.data;
}
