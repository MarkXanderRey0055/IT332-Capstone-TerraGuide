import type { NotificationLog } from './types';

const NOTIFICATIONS_STORAGE_KEY = 'terraguide_notifications';
export const NOTIFICATIONS_UPDATED_EVENT = 'terraguide-notifications-updated';

export function loadNotifications(): NotificationLog[] {
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NotificationLog[]) : [];
  } catch {
    return [];
  }
}

export function saveNotifications(notifications: NotificationLog[]): void {
  window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
}

export function getUnreadNotificationCount(): number {
  return loadNotifications().filter((notification) => !notification.read).length;
}

function appendNotification(notification: Omit<NotificationLog, 'id'>): void {
  const notifications = loadNotifications();
  const newNotification: NotificationLog = {
    id: Date.now(),
    ...notification,
  };
  saveNotifications([newNotification, ...notifications]);
}

export function notifyBuyerSignup(username: string): void {
  appendNotification({
    type: 'signup',
    title: 'New buyer registered',
    sub: `${username} created a buyer account`,
    time: new Date().toISOString(),
    read: false,
    buyer: username,
  });
}

export function notifyInquiry(buyer: string, propertyName: string, inquiryId: number): void {
  appendNotification({
    type: 'inquiry',
    title: 'New property inquiry',
    sub: `${buyer} sent an inquiry about ${propertyName}`,
    time: new Date().toISOString(),
    read: false,
    inquiryId,
    buyer,
    property: propertyName,
  });
}

export function notifySiteVisitRequest(buyer: string, propertyName: string, visitId: number): void {
  appendNotification({
    type: 'visit',
    title: 'New site visit request',
    sub: `${buyer} requested a site visit for ${propertyName}`,
    time: new Date().toISOString(),
    read: false,
    visitId,
    buyer,
    property: propertyName,
  });
}

export function markAllNotificationsRead(): void {
  const notifications = loadNotifications();
  saveNotifications(notifications.map((notification) => ({ ...notification, read: true })));
}

export { NOTIFICATIONS_STORAGE_KEY };
