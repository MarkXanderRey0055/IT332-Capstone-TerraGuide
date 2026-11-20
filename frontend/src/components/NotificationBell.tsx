import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../services/NotificationService';

interface NotificationBellProps {
  onNavigate: (notification: AppNotification) => void;
  enabled?: boolean;
  variant?: 'buyer' | 'admin';
}

function relativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return 'just now';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate, enabled = true, variant = 'buyer' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const aliveRef = useRef(false);
  const countRequestRef = useRef(false);
  const listRequestRef = useRef(false);

  const refreshCount = useCallback(async () => {
    if (!enabled || countRequestRef.current) return;
    countRequestRef.current = true;
    try {
      const count = await getUnreadNotificationCount();
      if (aliveRef.current) setUnreadCount(count);
    } catch {
      // Keep the last known badge value when a poll fails.
    } finally {
      countRequestRef.current = false;
    }
  }, [enabled]);

  const refreshList = useCallback(async () => {
    if (!enabled || listRequestRef.current) return;
    listRequestRef.current = true;
    try {
      const nextNotifications = await getNotifications();
      if (aliveRef.current) setNotifications(nextNotifications);
    } catch {
      // Keep the last known notification list on transient failures.
    } finally {
      listRequestRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      aliveRef.current = false;
      setIsOpen(false);
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    aliveRef.current = true;
    void refreshCount();
    const intervalId = window.setInterval(() => void refreshCount(), 45_000);
    return () => {
      aliveRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [enabled, refreshCount]);

  useEffect(() => {
    if (!isOpen) return;
    void refreshList();
    void refreshCount();
  }, [isOpen, refreshCount, refreshList]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!notification.read) {
      try {
        await markNotificationRead(notification._id);
        setNotifications((current) => current.map((item) => item._id === notification._id ? { ...item, read: true } : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {
        // Preserve local state if the read update fails, but still honor navigation.
      }
    }
    setIsOpen(false);
    onNavigate(notification);
  };

  const handleMarkAllRead = async () => {
    if (!unreadCount || isMarkingAllRead) return;
    setIsMarkingAllRead(true);
    try {
      await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch {
      // Keep the last known list and badge when the request fails.
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const buyerStyle = variant === 'buyer';
  const buttonClass = buyerStyle
    ? 'text-[#E8F5EF] hover:text-[#B0E4CC]'
    : 'text-[#7c6a57] hover:text-[#2f2417]';

  if (!enabled) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg bg-transparent border-none cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] ${buttonClass}`}
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[9px] leading-4 font-bold text-center" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          role="dialog"
          aria-label="Notifications"
          className={`absolute right-0 top-full z-[100] mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border shadow-xl ${buyerStyle ? 'border-[rgba(40,90,72,0.25)] bg-[#0D1F1A] text-white' : 'border-[rgba(78,96,73,0.2)] bg-white text-[#2f2417]'}`}
        >
          <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${buyerStyle ? 'border-[rgba(40,90,72,0.25)]' : 'border-neutral-200'}`}>
            <h2 className="text-sm font-bold">Notifications</h2>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={!unreadCount || isMarkingAllRead}
              className={`inline-flex items-center gap-1 text-[11px] font-semibold bg-transparent border-none cursor-pointer disabled:opacity-50 disabled:cursor-default ${buyerStyle ? 'text-[#B0E4CC]' : 'text-[#356a50]'}`}
            >
              <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
              {isMarkingAllRead ? 'Marking…' : 'Mark all as read'}
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto" aria-live="polite">
            {notifications.length === 0 ? (
              <p className={`px-4 py-8 text-center text-sm ${buyerStyle ? 'text-[#9ab6a9]' : 'text-[#7c6a57]'}`}>No notifications yet</p>
            ) : (
              <ul className="divide-y divide-current/10">
                {notifications.map((notification) => (
                  <li key={notification._id}>
                    <button
                      type="button"
                      onClick={() => void handleNotificationClick(notification)}
                      className={`w-full px-4 py-3 text-left transition-colors cursor-pointer ${buyerStyle ? 'hover:bg-white/5' : 'hover:bg-neutral-50'} ${notification.read ? 'opacity-75' : ''}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-xs font-bold">{notification.title}</span>
                          <span className={`mt-1 block text-xs leading-relaxed ${buyerStyle ? 'text-[#c4d8ce]' : 'text-[#5c5145]'}`}>{notification.message}</span>
                          <span className={`mt-1.5 block text-[10px] ${buyerStyle ? 'text-[#8ba99a]' : 'text-[#887966]'}`}>{relativeTime(notification.createdAt)}</span>
                        </span>
                        {notification.read ? <Check className="w-3.5 h-3.5 shrink-0 opacity-50" aria-label="Read" /> : <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-[#60a5fa]" aria-label="Unread" />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
