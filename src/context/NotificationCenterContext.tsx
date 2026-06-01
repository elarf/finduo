import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { InAppNotification, NotificationSource } from '../lib/notifications/types';
import { loadNotifications, saveNotifications } from '../lib/notifications/storage';
import { initNotificationBridge } from '../lib/notifications/bridge';
import { confirmMedicationIntake } from '../lib/finmed/actions';
import { acknowledgeServiceInterval } from '../lib/fingo/actions';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface NotificationCenterContextValue {
  notifications: InAppNotification[];
  unreadCount: number;
  loading: boolean;

  pushNotification: (
    source: NotificationSource,
    title: string,
    body: string,
    metadata?: InAppNotification['metadata'],
  ) => Promise<void>;

  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;

  markDone: (notificationId: string) => Promise<{ success: boolean; error?: string }>;
  allDone: () => Promise<void>;

  isPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
}

const NotificationCenterContext = createContext<NotificationCenterContextValue | undefined>(
  undefined,
);

export function NotificationCenterProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Persist on every update
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;

  useEffect(() => {
    void saveNotifications(notifications);
  }, [notifications]);

  // Load on mount
  useEffect(() => {
    void loadNotifications().then((loaded) => {
      setNotifications(loaded);
      setLoading(false);
    });
  }, []);

  const pushNotification = useCallback(
    async (
      source: NotificationSource,
      title: string,
      body: string,
      metadata?: InAppNotification['metadata'],
    ) => {
      const notification: InAppNotification = {
        id: uuidv4(),
        source,
        title,
        body,
        timestamp: new Date().toISOString(),
        isRead: false,
        isDone: false,
        metadata,
      };

      setNotifications((prev) => [notification, ...prev]);
    },
    [],
  );

  // Initialize notification bridge
  useEffect(() => {
    initNotificationBridge(pushNotification);
  }, [pushNotification]);

  const markRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
    );
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const markDone = useCallback(
    async (notificationId: string): Promise<{ success: boolean; error?: string }> => {
      const notification = notificationsRef.current.find((n) => n.id === notificationId);
      if (!notification || !user) {
        return { success: false, error: 'Notification not found or user not logged in' };
      }

      // Execute functional action based on source
      let result: { success: boolean; error?: string } = { success: false };

      switch (notification.source) {
        case 'finmed_intake_reminder': {
          const { medicationId, scheduleId } = notification.metadata ?? {};
          if (!medicationId) {
            result = { success: false, error: 'Missing medication ID' };
            break;
          }

          // Fetch medication data
          const { data: med } = await supabase
            .from('finmed_medications')
            .select('*')
            .eq('id', medicationId)
            .single();

          if (!med) {
            result = { success: false, error: 'Medication not found' };
            break;
          }

          // Use default dose of 1 (could be enhanced to look up actual dose from reminder)
          result = await confirmMedicationIntake(user.id, med, scheduleId ?? null, 1, null);
          break;
        }

        case 'fingo_service_due': {
          const { intervalId, componentId, assetId } = notification.metadata ?? {};
          if (!intervalId || !componentId || !assetId) {
            result = { success: false, error: 'Missing service interval data' };
            break;
          }
          result = await acknowledgeServiceInterval(user.id, intervalId, componentId, assetId);
          break;
        }

        default:
          result = { success: true }; // Non-actionable notifications just mark as done
      }

      if (result.success) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isDone: true, isRead: true } : n,
          ),
        );
      }

      return result;
    },
    [user],
  );

  const allDone = useCallback(async () => {
    const actionableNotifs = notificationsRef.current.filter(
      (n) =>
        !n.isDone &&
        (n.source === 'finmed_intake_reminder' || n.source === 'fingo_service_due'),
    );

    for (const notif of actionableNotifs) {
      await markDone(notif.id);
    }
  }, [markDone]);

  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationCenterContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        pushNotification,
        markRead,
        markAllRead,
        markDone,
        allDone,
        isPanelOpen,
        openPanel,
        closePanel,
      }}
    >
      {children}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter(): NotificationCenterContextValue {
  const ctx = useContext(NotificationCenterContext);
  if (!ctx) {
    throw new Error('useNotificationCenter must be used within NotificationCenterProvider');
  }
  return ctx;
}
