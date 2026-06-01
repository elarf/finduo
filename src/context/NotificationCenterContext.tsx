import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import type { InAppNotification, NotificationSource } from '../lib/notifications/types';
import { loadNotifications, saveNotifications } from '../lib/notifications/storage';
import { initNotificationBridge } from '../lib/notifications/bridge';
import { confirmMedicationIntake } from '../lib/finmed/actions';
import { acknowledgeServiceInterval } from '../lib/fingo/actions';
import { computeIntervalHealthFromLogs, formatIntervalRemaining, trackingMethodUnit } from '../lib/fingo/health';
import { supabase } from '../lib/supabase';
import type { MedicationReminderConfig } from '../types/finmed';
import type { Component, ComponentServiceInterval, UsageLog } from '../types/fingo';
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

function createNotificationId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type SyntheticNotificationSeed = {
  id: string;
  source: NotificationSource;
  title: string;
  body: string;
  metadata?: InAppNotification['metadata'];
};

function formatNextTime(date: Date): string {
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = tomorrow.toDateString() === date.toDateString();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `today at ${time}`;
  if (isTomorrow) return `tomorrow at ${time}`;
  return `${date.toLocaleDateString()} ${time}`;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function nextReminderDate(reminder: any): Date | null {
  const now = new Date();

  if (reminder.frequency_type === 'multiple_times_daily') {
    const times: string[] = reminder.frequency_config?.times ?? [];
    if (times.length === 0) return null;

    const candidates = times.map((t) => {
      const [h, m] = t.split(':').map(Number);
      const d = new Date(now);
      d.setHours(h, m, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 1);
      return d;
    });
    candidates.sort((a, b) => a.getTime() - b.getTime());
    return candidates[0] ?? null;
  }

  if (reminder.frequency_type === 'interval') {
    const hours = reminder.frequency_config?.interval_hours ?? 8;
    return new Date(now.getTime() + hours * 3_600_000);
  }

  if (reminder.frequency_type === 'specific_day_of_week') {
    const weekdays: number[] = reminder.frequency_config?.weekdays ?? [];
    if (weekdays.length === 0) return null;

    const candidates = weekdays.map((weekday) => {
      const d = new Date(now);
      const daysUntil = (weekday - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + daysUntil);
      d.setHours(8, 0, 0, 0);
      return d;
    });
    candidates.sort((a, b) => a.getTime() - b.getTime());
    return candidates[0] ?? null;
  }

  if (reminder.frequency_type === 'cyclic') {
    const intakeDays = reminder.frequency_config?.cycle_intake_days;
    const pauseDays = reminder.frequency_config?.cycle_pause_days;
    if (!intakeDays || !pauseDays) return null;

    const start = new Date(reminder.start_date);
    const cycleLength = intakeDays + pauseDays;
    const elapsed = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
    const pos = ((elapsed % cycleLength) + cycleLength) % cycleLength;

    const d = new Date(now);
    if (pos < intakeDays) {
      d.setHours(8, 0, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 1);
      return d;
    }
    d.setDate(d.getDate() + (cycleLength - pos));
    d.setHours(8, 0, 0, 0);
    return d;
  }

  return null;
}

function mergeWithSyntheticNotifications(
  prev: InAppNotification[],
  synthetic: SyntheticNotificationSeed[],
): InAppNotification[] {
  const prevById = new Map(prev.map((n) => [n.id, n]));
  const nowIso = new Date().toISOString();

  const hydratedSynthetic = synthetic.map((seed) => {
    const existing = prevById.get(seed.id);
    return {
      id: seed.id,
      source: seed.source,
      title: seed.title,
      body: seed.body,
      metadata: seed.metadata,
      timestamp: existing?.timestamp ?? nowIso,
      isRead: existing?.isRead ?? false,
      isDone: existing?.isDone ?? false,
    } as InAppNotification;
  });

  const nonSynthetic = prev.filter(
    (n) => !n.id.startsWith('synthetic:fingo:') && !n.id.startsWith('synthetic:finmed:'),
  );

  return [...hydratedSynthetic, ...nonSynthetic].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

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
        id: createNotificationId(),
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

  const refreshSystemNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const synthetic: SyntheticNotificationSeed[] = [];

      // FinGo: include warning/overdue service intervals so upcoming work appears in center.
      const [{ data: memberRows }, { data: ownedAssets }] = await Promise.all([
        supabase.from('asset_members').select('asset_id').eq('user_id', user.id),
        supabase.from('assets').select('id').eq('created_by', user.id),
      ]);

      const assetIdSet = new Set<string>();
      (memberRows ?? []).forEach((r: any) => r?.asset_id && assetIdSet.add(r.asset_id));
      (ownedAssets ?? []).forEach((r: any) => r?.id && assetIdSet.add(r.id));
      const assetIds = Array.from(assetIdSet);

      if (assetIds.length > 0) {
        const { data: componentsData } = await supabase
          .from('components')
          .select('*')
          .in('installed_on_asset_id', assetIds)
          .eq('status', 'installed');

        const components = (componentsData ?? []) as Component[];
        if (components.length > 0) {
          const componentIds = components.map((c) => c.id);

          const [{ data: intervalsData }, { data: logsData }] = await Promise.all([
            supabase.from('component_service_intervals').select('*').in('component_id', componentIds),
            supabase
              .from('usage_logs')
              .select('asset_id,usage_delta,moving_time_delta,elevation_delta,recorded_at')
              .in('asset_id', assetIds),
          ]);

          const intervals = (intervalsData ?? []) as ComponentServiceInterval[];
          const logs = (logsData ?? []) as UsageLog[];

          const compById = new Map(components.map((c) => [c.id, c]));
          const logsByAsset = new Map<string, UsageLog[]>();
          for (const log of logs) {
            const arr = logsByAsset.get(log.asset_id) ?? [];
            arr.push(log);
            logsByAsset.set(log.asset_id, arr);
          }

          for (const interval of intervals) {
            const comp = compById.get(interval.component_id);
            if (!comp) continue;

            const assetLogs = comp.installed_on_asset_id
              ? logsByAsset.get(comp.installed_on_asset_id) ?? []
              : [];

            const health = computeIntervalHealthFromLogs(
              interval,
              comp,
              assetLogs,
              interval.last_serviced_at ?? null,
            );

            if (!health.isWarning && !health.isOverdue) continue;

            const unit = trackingMethodUnit(interval.tracking_method);
            const overdueBy = Math.round(Math.abs(health.remaining) * 10) / 10;
            const body = health.isOverdue
              ? `${comp.name}: overdue by ${overdueBy} ${unit}`
              : `${comp.name}: ${formatIntervalRemaining(health)} remaining`;

            synthetic.push({
              id: `synthetic:fingo:${interval.id}`,
              source: 'fingo_service_due',
              title: interval.name,
              body,
              metadata: {
                intervalId: interval.id,
                componentId: interval.component_id,
                assetId: comp.installed_on_asset_id ?? undefined,
              },
            });
          }
        }
      }

      // FinMed: include active medication reminders as upcoming entries.
      const { data: remindersData } = await supabase
        .from('finmed_reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true);

      const reminders = remindersData ?? [];
      const now = new Date();

      for (const reminder of reminders) {
        if (reminder.type !== 'medication') continue;
        if (reminder.frequency_type === 'on_demand') continue;
        if (reminder.end_date && new Date(reminder.end_date) < now) continue;

        const medConfig = reminder.type === 'medication'
          ? (reminder.type_config as MedicationReminderConfig)
          : null;

        const next = nextReminderDate(reminder);
        if (!next || !isSameLocalDay(next, now)) continue;
        const cadence = next ? `Next ${formatNextTime(next)}` : 'Upcoming reminder';
        const doseText = medConfig
          ? `${medConfig.dose_amount} ${medConfig.dose_unit}`
          : 'health check';

        synthetic.push({
          id: `synthetic:finmed:${reminder.id}`,
          source: 'finmed_intake_reminder',
          title: reminder.label,
          body: `${doseText} - ${cadence}`,
          metadata: {
            reminderId: reminder.id,
            medicationId: medConfig?.medication_id,
          },
        });
      }

      setNotifications((prev) => mergeWithSyntheticNotifications(prev, synthetic));
    } catch {
      // Keep existing notifications if dynamic refresh fails.
    }
  }, [user?.id]);

  // Initialize notification bridge
  useEffect(() => {
    initNotificationBridge(pushNotification);
  }, [pushNotification]);

  useEffect(() => {
    void refreshSystemNotifications();
  }, [refreshSystemNotifications]);

  useEffect(() => {
    if (!isPanelOpen) return;
    void refreshSystemNotifications();
  }, [isPanelOpen, refreshSystemNotifications]);

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
