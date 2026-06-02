import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { InAppNotification, NotificationSource } from '../lib/notifications/types';
import { loadNotifications, saveNotifications } from '../lib/notifications/storage';
import { initNotificationBridge } from '../lib/notifications/bridge';
import { confirmMedicationIntake } from '../lib/finmed/actions';
import { acknowledgeServiceInterval } from '../lib/fingo/actions';
import { computeIntervalHealthFromLogs, formatIntervalRemaining, trackingMethodUnit } from '../lib/fingo/health';
import { supabase } from '../lib/supabase';
import type { FinmedReminder, MedicationReminderConfig } from '../types/finmed';
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

function liveNotificationId(
  source: NotificationSource,
  metadata?: InAppNotification['metadata'],
): string | null {
  if (source === 'fingo_service_due' && metadata?.intervalId) {
    return `live:fingo:${metadata.intervalId}`;
  }

  if (source === 'finmed_intake_reminder' && metadata?.reminderId) {
    const slotKey = metadata.slotIndex ?? 'na';
    return `live:finmed:${metadata.reminderId}:${slotKey}`;
  }

  return null;
}

function readMedicationReminderConfig(reminder: Pick<FinmedReminder, 'type' | 'type_config'>): {
  medicationId?: string;
  doseAmount: number;
  doseUnit: string;
} | null {
  if (reminder.type !== 'medication') return null;

  let parsedTypeConfig: unknown = reminder.type_config ?? {};
  if (typeof parsedTypeConfig === 'string') {
    try {
      parsedTypeConfig = JSON.parse(parsedTypeConfig);
    } catch {
      parsedTypeConfig = {};
    }
  }

  const cfg = (parsedTypeConfig ?? {}) as MedicationReminderConfig & {
    medicationId?: string;
    doseAmount?: number;
    doseUnit?: string;
    medication?: { id?: string };
    dose?: { amount?: number; unit?: string };
  };

  const fallbackReminder = reminder as FinmedReminder & {
    medication_id?: string;
    medicationId?: string;
  };

  const rawMedicationId =
    cfg.medication_id ??
    cfg.medicationId ??
    cfg.medication?.id ??
    fallbackReminder.medication_id ??
    fallbackReminder.medicationId;

  const medicationId = typeof rawMedicationId === 'string' && rawMedicationId.trim().length > 0
    ? rawMedicationId.trim()
    : undefined;

  const doseAmount = cfg.dose_amount ?? cfg.doseAmount ?? cfg.dose?.amount ?? 1;
  const doseUnit = cfg.dose_unit ?? cfg.doseUnit ?? cfg.dose?.unit ?? 'pill';

  return {
    medicationId,
    doseAmount,
    doseUnit,
  };
}

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

function nextReminderSlotIndex(reminder: any, now = new Date()): number | undefined {
  if (reminder.frequency_type !== 'multiple_times_daily') return undefined;
  const times: string[] = reminder.frequency_config?.times ?? [];
  if (times.length === 0) return undefined;

  let bestIdx: number | undefined;
  let bestTime: number | undefined;

  for (let i = 0; i < times.length; i++) {
    const [h, m] = times[i].split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) continue;

    const candidate = new Date(now);
    candidate.setHours(h, m, 0, 0);
    if (candidate <= now) continue;

    const ts = candidate.getTime();
    if (bestTime === undefined || ts < bestTime) {
      bestTime = ts;
      bestIdx = i;
    }
  }

  return bestIdx;
}

function getUpcomingTodaySlots(reminder: any, now = new Date()): Array<{ slotIndex: number; at: Date }> {
  if (reminder.frequency_type !== 'multiple_times_daily') return [];
  const times: string[] = reminder.frequency_config?.times ?? [];

  const slots: Array<{ slotIndex: number; at: Date }> = [];
  for (let i = 0; i < times.length; i++) {
    const [h, m] = times[i].split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) continue;

    const at = new Date(now);
    at.setHours(h, m, 0, 0);
    if (!isSameLocalDay(at, now)) continue;
    if (at <= now) continue;

    slots.push({ slotIndex: i, at });
  }

  return slots.sort((a, b) => a.at.getTime() - b.at.getTime());
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
  const queryClient = useQueryClient();
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
      const stableId = liveNotificationId(source, metadata);
      const nowIso = new Date().toISOString();

      setNotifications((prev) => {
        if (stableId) {
          const existingIndex = prev.findIndex((n) => n.id === stableId);
          const liveNotification: InAppNotification = {
            id: stableId,
            source,
            title,
            body,
            timestamp: nowIso,
            isRead: false,
            isDone: false,
            metadata,
          };

          if (existingIndex >= 0) {
            return [
              liveNotification,
              ...prev.filter((_, idx) => idx !== existingIndex),
            ];
          }

          return [liveNotification, ...prev];
        }

        const notification: InAppNotification = {
          id: createNotificationId(),
          source,
          title,
          body,
          timestamp: nowIso,
          isRead: false,
          isDone: false,
          metadata,
        };

        return [notification, ...prev];
      });
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

      // FinMed: include active medication reminders as upcoming entries,
      // but skip reminders/slots already resolved today.
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [{ data: remindersData }, { data: reminderLogsData }] = await Promise.all([
        supabase
          .from('finmed_reminders')
          .select('*')
          .eq('user_id', user.id)
          .eq('active', true),
        supabase
          .from('finmed_reminder_logs')
          .select('reminder_id,action,metadata,created_at')
          .eq('user_id', user.id)
          .in('action', ['complete', 'ignore'])
          .gte('created_at', todayStart.toISOString()),
      ]);

      const resolvedReminderKeys = new Set<string>();
      for (const row of reminderLogsData ?? []) {
        const metadata = (row as { metadata?: { slotIndex?: number } | null }).metadata;
        const slotIndex = metadata?.slotIndex;
        if (typeof slotIndex === 'number') {
          resolvedReminderKeys.add(`${row.reminder_id}:${slotIndex}`);
        } else {
          resolvedReminderKeys.add(row.reminder_id);
        }
      }

      const reminders = remindersData ?? [];
      const now = new Date();

      for (const reminder of reminders) {
        if (resolvedReminderKeys.has(reminder.id)) continue;

        if (reminder.type !== 'medication') continue;
        if (reminder.frequency_type === 'on_demand') continue;
        if (reminder.end_date && new Date(reminder.end_date) < now) continue;

        const medConfig = readMedicationReminderConfig(reminder as FinmedReminder);
        const doseText = medConfig
          ? `${medConfig.doseAmount} ${medConfig.doseUnit}`
          : 'health check';

        if (reminder.frequency_type === 'multiple_times_daily') {
          const upcomingSlots = getUpcomingTodaySlots(reminder, now);
          for (const slot of upcomingSlots) {
            if (resolvedReminderKeys.has(`${reminder.id}:${slot.slotIndex}`)) continue;

            const cadence = `Next ${formatNextTime(slot.at)}`;
            synthetic.push({
              id: `synthetic:finmed:${reminder.id}:${slot.slotIndex}`,
              source: 'finmed_intake_reminder',
              title: reminder.label,
              body: `${doseText} - ${cadence}`,
              metadata: {
                reminderId: reminder.id,
                medicationId: medConfig?.medicationId,
                slotIndex: slot.slotIndex,
              } as InAppNotification['metadata'] & { slotIndex?: number },
            });
          }
          continue;
        }

        const next = nextReminderDate(reminder);
        if (!next || !isSameLocalDay(next, now)) continue;
        const cadence = next ? `Next ${formatNextTime(next)}` : 'Upcoming reminder';

        synthetic.push({
          id: `synthetic:finmed:${reminder.id}`,
          source: 'finmed_intake_reminder',
          title: reminder.label,
          body: `${doseText} - ${cadence}`,
          metadata: {
            reminderId: reminder.id,
            medicationId: medConfig?.medicationId,
            slotIndex: nextReminderSlotIndex(reminder, now),
          } as InAppNotification['metadata'] & { slotIndex?: number },
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
      console.log('[NotificationCenter] markDone:start', { notificationId, userId: user?.id });
      try {
        const notification = notificationsRef.current.find((n) => n.id === notificationId);
        if (!notification || !user) {
          console.warn('[NotificationCenter] markDone:missing-notification-or-user', {
            notificationId,
            hasNotification: !!notification,
            hasUser: !!user,
          });
          return { success: false, error: 'Notification not found or user not logged in' };
        }

        console.log('[NotificationCenter] markDone:notification', {
          id: notification.id,
          source: notification.source,
          isDone: notification.isDone,
          isRead: notification.isRead,
          metadata: notification.metadata,
        });

        // Execute functional action based on source
        let result: { success: boolean; error?: string } = { success: false };

        switch (notification.source) {
          case 'finmed_intake_reminder': {
            const { reminderId, medicationId, scheduleId, slotIndex } =
              (notification.metadata ?? {}) as InAppNotification['metadata'] & { slotIndex?: number };
            let warningMessage: string | undefined;

            console.log('[NotificationCenter] markDone:finmed:metadata', {
              reminderId,
              medicationId,
              scheduleId,
              slotIndex,
            });

            let reminder: FinmedReminder | null = null;
            if (reminderId) {
              const { data: reminderData, error: reminderError } = await supabase
                .from('finmed_reminders')
                .select('*')
                .eq('id', reminderId)
                .single();

              if (reminderError) {
                console.warn('[NotificationCenter] markDone:finmed:reminder-fetch-failed', {
                  reminderId,
                  error: reminderError.message,
                });
                // Continue with metadata fallback when reminder fetch fails.
                warningMessage = reminderError.message;
              } else {
                reminder = (reminderData as FinmedReminder | null) ?? null;
                console.log('[NotificationCenter] markDone:finmed:reminder-fetched', {
                  reminderId,
                  type: reminder?.type,
                  frequencyType: reminder?.frequency_type,
                  typeConfig: reminder?.type_config,
                });
              }
            }

            const reminderType = reminder?.type ?? null;
            const resolvedSlotIndex =
              typeof slotIndex === 'number'
                ? slotIndex
                : (reminder ? nextReminderSlotIndex(reminder, new Date()) : undefined);

            if (reminderType === 'medication' || (!reminderType && medicationId)) {
              const medConfig = reminder ? readMedicationReminderConfig(reminder) : null;
              const resolvedMedicationId = medConfig?.medicationId ?? medicationId;

              if (!resolvedMedicationId) {
                console.warn('[NotificationCenter] markDone:finmed:missing-medication-id', {
                  reminderId,
                  medicationId,
                  medConfig,
                  reminderTypeConfig: reminder?.type_config,
                  resolvedSlotIndex,
                });
                // Fall back to reminder completion only so the UI still resolves the notification.
                result = {
                  success: true,
                  error: 'Medication link missing; reminder marked complete only.',
                };
              } else {
                const { data: med, error: medError } = await supabase
                  .from('finmed_medications')
                  .select('*')
                  .eq('id', resolvedMedicationId)
                  .single();

                if (medError || !med) {
                  console.warn('[NotificationCenter] markDone:finmed:medication-fetch-failed', {
                    resolvedMedicationId,
                    error: medError?.message,
                  });
                  result = { success: false, error: medError?.message ?? 'Medication not found' };
                  break;
                }

                const doseAmount = medConfig?.doseAmount ?? 1;
                console.log('[NotificationCenter] markDone:finmed:confirm-intake', {
                  medicationId: med.id,
                  scheduleId: scheduleId ?? null,
                  doseAmount,
                  resolvedSlotIndex,
                });

                result = await confirmMedicationIntake(user.id, med, scheduleId ?? null, doseAmount, null);
                console.log('[NotificationCenter] markDone:finmed:confirm-intake-result', { result });
                if (!result.success) break;
              }
            } else {
              console.log('[NotificationCenter] markDone:finmed:non-medication-reminder-or-fallback');
              result = { success: true };
            }

            // Mirror FinMed Today completion logging so notification-center completion behaves the same.
            if (reminderId) {
              const now = new Date().toISOString();
              const { error: logError } = await supabase.from('finmed_reminder_logs').insert({
                user_id: user.id,
                reminder_id: reminderId,
                scheduled_for: now,
                action: 'complete',
                completed_at: now,
                ignored_at: null,
                snoozed_until: null,
                value: null,
                note: null,
                metadata: resolvedSlotIndex !== undefined ? { slotIndex: resolvedSlotIndex } : null,
              });

              if (logError) {
                console.warn('[NotificationCenter] markDone:finmed:log-sync-failed', {
                  reminderId,
                  error: logError.message,
                });
                // Do not undo a successful confirmation if auxiliary reminder-log sync fails.
                warningMessage = warningMessage ?? logError.message;
              } else {
                console.log('[NotificationCenter] markDone:finmed:log-sync-success', { reminderId });
              }
            }

            if (result.success && warningMessage) {
              result = { success: true, error: warningMessage };
            }

            break;
          }

          case 'fingo_service_due': {
            const { intervalId, componentId, assetId } = notification.metadata ?? {};
            if (!intervalId || !componentId || !assetId) {
              console.warn('[NotificationCenter] markDone:fingo:missing-metadata', {
                intervalId,
                componentId,
                assetId,
              });
              result = { success: false, error: 'Missing service interval data' };
              break;
            }
            result = await acknowledgeServiceInterval(user.id, intervalId, componentId, assetId);
            console.log('[NotificationCenter] markDone:fingo:result', { result });
            break;
          }

          default:
            console.log('[NotificationCenter] markDone:default-source', { source: notification.source });
            result = { success: true }; // Non-actionable notifications just mark as done
        }

        console.log('[NotificationCenter] markDone:pre-state-update', {
          notificationId,
          source: notification.source,
          result,
        });

        if (result.success) {
          setNotifications((prev) => {
            const isActionableSource =
              notification.source === 'finmed_intake_reminder' ||
              notification.source === 'fingo_service_due';

            const updated = isActionableSource
              ? prev.filter((n) => n.id !== notificationId)
              : prev.map((n) =>
                  n.id === notificationId ? { ...n, isDone: true, isRead: true } : n,
                );

            const updatedItem = updated.find((n) => n.id === notificationId);
            console.log('[NotificationCenter] markDone:state-updated', {
              notificationId,
              removed: isActionableSource,
              updatedItem,
            });
            return updated;
          });

          if (notification.source === 'finmed_intake_reminder') {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['finmed_medications', user.id] }),
              queryClient.invalidateQueries({ queryKey: ['finmed_reminders', user.id] }),
              queryClient.invalidateQueries({ queryKey: ['finmed_reminder_logs', user.id] }),
            ]);
            console.log('[NotificationCenter] markDone:finmed:queries-invalidated', { userId: user.id });
          }
        }

        console.log('[NotificationCenter] markDone:end', { notificationId, result });
        return result;
      } catch (err) {
        console.error('[NotificationCenter] markDone:threw', { notificationId, err });
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to complete notification action',
        };
      }
    },
    [queryClient, user],
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
