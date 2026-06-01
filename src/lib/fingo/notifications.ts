import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabase';
import { navigationRef, setPendingNotification } from '../../navigation/navigationRef';
import { computeIntervalHealthFromLogs, formatIntervalRemaining, trackingMethodUnit } from './health';
import type { Component, ComponentServiceInterval, UsageLog } from '../../types/fingo';
import { logNotif } from '../devtools';
import { mirrorNotification } from '../notifications/bridge';

const CHANNEL_ID = 'fingo_service_due';

type TrackableComponent = Pick<
  Component,
  'id' | 'name' | 'track_distance' | 'track_rides' | 'track_moving_time' | 'track_elapsed_time' | 'track_elevation_gain'
>;

function intervalNotifId(intervalId: string): number {
  let hash = 0;
  for (let i = 0; i < intervalId.length; i++) {
    hash = ((hash << 5) - hash + intervalId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_000_000_000;
}

export async function setupFinGoChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Service due',
      description: 'Alerts for overdue or approaching component service intervals',
      importance: 3,
      visibility: 1,
      vibration: true,
    });
  } catch {
    // non-fatal — channel may already exist
  }
}

export async function setupFinMedChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  try {
    await LocalNotifications.createChannel({
      id: 'finmed_intake',
      name: 'Med Take reminder',
      description: 'Reminders to take medications',
      importance: 4,
      visibility: 1,
      vibration: true,
    });
    await LocalNotifications.createChannel({
      id: 'finmed_low_stock',
      name: 'Med Stock reminder',
      description: 'Alerts when medication stock is low',
      importance: 3,
      visibility: 1,
      vibration: true,
    });
  } catch {
    // non-fatal — channels may already exist
  }
}

/** Cancel pending or delivered notifications for the given interval IDs */
export async function cancelIntervalNotifications(intervalIds: string[]): Promise<void> {
  if (!Capacitor.isNativePlatform() || intervalIds.length === 0) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({
      notifications: intervalIds.map((id) => ({ id: intervalNotifId(id) })),
    });
  } catch {
    // non-fatal
  }
}

/**
 * Set up the notification tap listener once at app startup.
 * Navigates to ServiceIntervalDetail when a service-due notification is tapped.
 */
export function setupNotificationActionListener(): void {
  if (!Capacitor.isNativePlatform()) return;
  import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
    LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const extra = event.notification.extra as
        | { intervalId?: string; componentId?: string; assetId?: string }
        | undefined;

      // Log action performed
      logNotif('ACTION', {
        module: 'fingo',
        actionId: event.actionId,
        notificationId: event.notification.id,
        title: event.notification.title,
        body: event.notification.body,
        extra,
      });

      if (!extra?.intervalId || !extra?.componentId || !extra?.assetId) return;
      if (navigationRef.isReady()) {
        navigationRef.navigate('ServiceIntervalDetail', {
          intervalId: extra.intervalId,
          componentId: extra.componentId,
          assetId: extra.assetId,
        });
      } else {
        setPendingNotification({
          intervalId: extra.intervalId,
          componentId: extra.componentId,
          assetId: extra.assetId,
        });
      }
    }).catch(() => {});
  }).catch(() => {});
}

/**
 * Setup notification received listener for FinGo.
 * Logs when notifications are shown/received.
 * Should be called once at app startup.
 */
export function setupFinGoNotificationReceivedListener(): void {
  if (!Capacitor.isNativePlatform()) return;

  import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
    LocalNotifications.addListener('localNotificationReceived', (event) => {
      logNotif('RECEIVED', {
        module: 'fingo',
        notificationId: event.id,
        title: event.title,
        body: event.body,
        extra: event.extra,
      });
    }).catch(() => {});
  }).catch(() => {});
}

export async function notifyDueIntervals(
  componentIds: string[],
  components: TrackableComponent[],
  assetId: string,
): Promise<void> {
  if (!Capacitor.isNativePlatform() || componentIds.length === 0) return;

  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const { display } = await LocalNotifications.checkPermissions();
  if (display !== 'granted') {
    const { display: after } = await LocalNotifications.requestPermissions();
    if (after !== 'granted') return;
  }

  const { data: intervals } = await supabase
    .from('component_service_intervals')
    .select('*')
    .in('component_id', componentIds);

  if (!intervals || intervals.length === 0) return;

  const { data: logsData } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('asset_id', assetId)
    .order('recorded_at', { ascending: false });
  const usageLogs = (logsData ?? []) as UsageLog[];

  const toSchedule: {
    id: number;
    title: string;
    body: string;
    smallIcon: string;
    largeIcon: string;
    channelId: string;
    schedule: { at: Date };
    extra: { intervalId: string; componentId: string; assetId: string };
  }[] = [];
  const toCancel: { id: number }[] = [];

  for (const interval of intervals as ComponentServiceInterval[]) {
    const comp = components.find(c => c.id === interval.component_id);
    if (!comp) continue;

    const health = computeIntervalHealthFromLogs(interval, comp as Component, usageLogs, interval.last_serviced_at ?? null);
    const notifId = intervalNotifId(interval.id);

    if (!health.isWarning && !health.isOverdue) {
      // Interval is healthy — cancel any lingering notification
      toCancel.push({ id: notifId });
      continue;
    }

    const unit = trackingMethodUnit(interval.tracking_method);
    const overdueBy = Math.round(Math.abs(health.remaining) * 10) / 10;

    // Distinguish "due" (remaining === 0) from "overdue" (remaining < 0)
    const isDue = health.remaining === 0;

    const notificationBody = isDue
      ? `${comp.name}: service due`
      : health.isOverdue
      ? `${comp.name}: overdue by ${overdueBy} ${unit}`
      : `${comp.name}: ${formatIntervalRemaining(health)} remaining`;

    toSchedule.push({
      id: notifId,
      title: interval.name,
      body: notificationBody,
      smallIcon: 'ic_maintenance_monochrome',
      largeIcon: 'asset://assets/maintenance.png',
      channelId: CHANNEL_ID,
      schedule: { at: new Date(Date.now() + 1000) },
      extra: { intervalId: interval.id, componentId: interval.component_id, assetId },
    });

    // Mirror to in-app notification center
    await mirrorNotification(
      'fingo_service_due',
      interval.name,
      notificationBody,
      {
        intervalId: interval.id,
        componentId: interval.component_id,
        assetId,
      },
    );
  }

  if (toCancel.length > 0) {
    await LocalNotifications.cancel({ notifications: toCancel }).catch(() => {});
    toCancel.forEach((notif) => {
      logNotif('CANCELLED', {
        module: 'fingo',
        type: 'service_interval',
        id: notif.id,
      });
    });
  }

  if (toSchedule.length > 0) {
    await LocalNotifications.schedule({ notifications: toSchedule });
    toSchedule.forEach((notif) => {
      logNotif('SCHEDULED', {
        module: 'fingo',
        type: 'service_interval',
        id: notif.id,
        title: notif.title,
        body: notif.body,
        scheduledAt: notif.schedule.at.toISOString(),
        extra: notif.extra,
        channelId: notif.channelId,
      });
    });
  }
}
