import { Capacitor } from '@capacitor/core';
import { FINMED_INTAKE_CHANNEL, FINMED_LOW_STOCK_CHANNEL } from '../notificationChannels';
import type { FinmedReminder, FinmedMedication, MedicationReminderConfig } from '../../types/finmed';

const SMALL_ICON = 'ic_meds_monochrome';
const LARGE_ICON = 'asset://assets/meds.png';

function reminderNotifId(reminderId: string, slot = 0): number {
  let hash = 0;
  for (let i = 0; i < reminderId.length; i++) {
    hash = ((hash << 5) - hash + reminderId.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) + slot) % 2_000_000_000;
}

function slotIds(reminder: FinmedReminder): number[] {
  if (reminder.frequency_type === 'on_demand') return [];
  if (reminder.frequency_type === 'multiple_times_daily') {
    const count = (reminder.frequency_config.times ?? ['08:00']).length;
    return Array.from({ length: count }, (_, i) => reminderNotifId(reminder.id, i));
  }
  if (reminder.frequency_type === 'specific_day_of_week') {
    return (reminder.frequency_config.weekdays ?? []).map((_, i) => reminderNotifId(reminder.id, i));
  }
  return [reminderNotifId(reminder.id)];
}

function nextTimeToday(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
}

function nextWeekdayDate(dow: number): Date {
  const d = new Date();
  let daysAhead = dow - d.getDay();
  if (daysAhead <= 0) daysAhead += 7;
  d.setDate(d.getDate() + daysAhead);
  d.setHours(8, 0, 0, 0);
  return d;
}

function nextCyclicIntakeDate(reminder: FinmedReminder): Date | null {
  const { cycle_intake_days, cycle_pause_days } = reminder.frequency_config;
  if (!cycle_intake_days || !cycle_pause_days) return null;
  const cycleLen = cycle_intake_days + cycle_pause_days;
  const start = new Date(reminder.start_date);
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  const pos = ((elapsed % cycleLen) + cycleLen) % cycleLen;
  const at = new Date(now);
  if (pos < cycle_intake_days) {
    at.setHours(8, 0, 0, 0);
    if (at <= now) at.setDate(at.getDate() + 1);
  } else {
    at.setDate(at.getDate() + (cycleLen - pos));
    at.setHours(8, 0, 0, 0);
  }
  return at;
}

export async function scheduleIntakeReminder(reminder: FinmedReminder): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!reminder.active || reminder.frequency_type === 'on_demand') return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') {
      const { display: after } = await LocalNotifications.requestPermissions();
      if (after !== 'granted') return;
    }

    const medConfig = reminder.type === 'medication'
      ? (reminder.type_config as MedicationReminderConfig)
      : null;
    const body = medConfig
      ? `${medConfig.dose_amount} ${medConfig.dose_unit} — time to take your medication`
      : 'Time for your reminder';

    const toSchedule: { id: number; at: Date }[] = [];

    if (reminder.frequency_type === 'multiple_times_daily') {
      (reminder.frequency_config.times ?? ['08:00']).forEach((t, i) => {
        toSchedule.push({ id: reminderNotifId(reminder.id, i), at: nextTimeToday(t) });
      });
    } else if (reminder.frequency_type === 'interval') {
      const hours = reminder.frequency_config.interval_hours ?? 8;
      toSchedule.push({ id: reminderNotifId(reminder.id), at: new Date(Date.now() + hours * 3_600_000) });
    } else if (reminder.frequency_type === 'specific_day_of_week') {
      (reminder.frequency_config.weekdays ?? []).forEach((dow, i) => {
        toSchedule.push({ id: reminderNotifId(reminder.id, i), at: nextWeekdayDate(dow) });
      });
    } else if (reminder.frequency_type === 'cyclic') {
      const at = nextCyclicIntakeDate(reminder);
      if (at) toSchedule.push({ id: reminderNotifId(reminder.id), at });
    }

    if (toSchedule.length === 0) return;

    await LocalNotifications.schedule({
      notifications: toSchedule.map(({ id, at }) => ({
        id,
        title: reminder.label,
        body,
        smallIcon: SMALL_ICON,
        largeIcon: LARGE_ICON,
        channelId: FINMED_INTAKE_CHANNEL,
        schedule: { at },
        extra: { reminderId: reminder.id },
      })),
    });
  } catch {
    // non-fatal
  }
}

export async function cancelIntakeReminder(reminder: FinmedReminder): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const ids = slotIds(reminder);
  if (ids.length === 0) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    // non-fatal
  }
}

export async function scheduleStockAlert(medication: FinmedMedication): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') return;

    let hash = 0;
    for (let i = 0; i < medication.id.length; i++) {
      hash = ((hash << 5) - hash + medication.id.charCodeAt(i)) | 0;
    }
    // offset by 1_000_000_000 to avoid colliding with intake reminder IDs
    const id = (Math.abs(hash) + 1_000_000_000) % 2_000_000_000;

    await LocalNotifications.schedule({
      notifications: [{
        id,
        title: `Low stock: ${medication.name}`,
        body: `Only ${medication.stock_quantity} ${medication.unit} remaining`,
        smallIcon: SMALL_ICON,
        largeIcon: LARGE_ICON,
        channelId: FINMED_LOW_STOCK_CHANNEL,
        schedule: { at: new Date(Date.now() + 500) },
        extra: { medicationId: medication.id },
      }],
    });
  } catch {
    // non-fatal
  }
}
