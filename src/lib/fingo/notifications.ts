import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabase';
import { computeIntervalHealth, formatIntervalRemaining, trackingMethodUnit } from './health';
import type { Component, ComponentServiceInterval } from '../../types/fingo';

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

export async function notifyDueIntervals(
  componentIds: string[],
  components: TrackableComponent[],
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

  const toSchedule: { id: number; title: string; body: string; channelId: string; schedule: { at: Date } }[] = [];

  for (const interval of intervals as ComponentServiceInterval[]) {
    const comp = components.find(c => c.id === interval.component_id);
    if (!comp) continue;

    const health = computeIntervalHealth(interval, comp as Component);
    if (!health.isWarning && !health.isOverdue) continue;

    const unit = trackingMethodUnit(interval.tracking_method);
    const overdueBy = Math.round(Math.abs(health.remaining) * 10) / 10;

    toSchedule.push({
      id: intervalNotifId(interval.id),
      title: interval.name,
      body: health.isOverdue
        ? `${comp.name}: overdue by ${overdueBy} ${unit}`
        : `${comp.name}: ${formatIntervalRemaining(health)} remaining`,
      channelId: CHANNEL_ID,
      schedule: { at: new Date(Date.now() + 1000) },
    });
  }

  if (toSchedule.length > 0) {
    await LocalNotifications.schedule({ notifications: toSchedule });
  }
}
