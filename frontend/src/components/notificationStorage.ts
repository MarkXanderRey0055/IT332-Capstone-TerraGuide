import type { NotificationLog } from './types';

const NOTIFICATIONS_STORAGE_KEY = 'terraguide_notifications';

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
}

export function getUnreadNotificationCount(): number {
  return loadNotifications().filter((notification) => !notification.read).length;
}

export function notifyBuyerSignup(username: string): void {
  const notifications = loadNotifications();
  const newNotification: NotificationLog = {
    id: Date.now(),
    type: 'signup',
    title: 'New buyer registered',
    sub: `${username} created a buyer account`,
    time: new Date().toISOString(),
    read: false,
    buyer: username,
  };

  saveNotifications([newNotification, ...notifications]);
}

export function markAllNotificationsRead(): void {
  const notifications = loadNotifications();
  saveNotifications(notifications.map((notification) => ({ ...notification, read: true })));
}

export { NOTIFICATIONS_STORAGE_KEY };
