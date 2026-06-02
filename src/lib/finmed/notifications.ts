import { Capacitor } from '@capacitor/core';
import { FINMED_INTAKE_CHANNEL, FINMED_LOW_STOCK_CHANNEL } from '../notificationChannels';
import type { FinmedReminder, FinmedMedication, MedicationReminderConfig } from '../../types/finmed';
import { logNotif } from '../devtools';
import { mirrorNotification } from '../notifications/bridge';

const SMALL_ICON = 'ic_meds_monochrome';
const LARGE_ICON = 'asset://assets/meds.png';

// MyTherapy-style escalating notifications
const REPEAT_INTERVAL_MINUTES = 5;
const DEFAULT_MAX_REPEAT_WINDOW_MINUTES = 120; // 2 hours

function readMedicationReminderConfig(reminder: FinmedReminder): {
  medicationId?: string;
  doseAmount: number;
  doseUnit: string;
} | null {
  if (reminder.type !== 'medication') return null;

  const cfg = (reminder.type_config ?? {}) as MedicationReminderConfig & {
    medicationId?: string;
    doseAmount?: number;
    doseUnit?: string;
  };

  return {
    medicationId: cfg.medication_id ?? cfg.medicationId,
    doseAmount: cfg.dose_amount ?? cfg.doseAmount ?? 1,
    doseUnit: cfg.dose_unit ?? cfg.doseUnit ?? 'pill',
  };
}

/**
 * Generate deterministic notification ID for a reminder slot and repeat index.
 * slot = index of the time in the day (0 for first time, 1 for second, etc.)
 * repeatIndex = which repeat notification (0 = scheduled time, 1 = +5min, 2 = +10min, etc.)
 */
function reminderNotifId(reminderId: string, slot = 0, repeatIndex = 0): number {
  let hash = 0;
  for (let i = 0; i < reminderId.length; i++) {
    hash = ((hash << 5) - hash + reminderId.charCodeAt(i)) | 0;
  }
  // Use large multiplier to avoid collisions: baseId + (slot * 10000) + repeatIndex
  const baseId = Math.abs(hash) % 1_000_000;
  return (baseId + (slot * 10000) + repeatIndex) % 2_000_000_000;
}

/**
 * Get all notification IDs for a reminder, including all repeat slots.
 */
function allNotificationIds(reminder: FinmedReminder): number[] {
  if (reminder.frequency_type === 'on_demand') return [];

  const maxWindow = reminder.max_repeat_window_minutes ?? DEFAULT_MAX_REPEAT_WINDOW_MINUTES;
  const repeatCount = Math.ceil(maxWindow / REPEAT_INTERVAL_MINUTES);

  const ids: number[] = [];

  if (reminder.frequency_type === 'multiple_times_daily') {
    const times = reminder.frequency_config.times ?? ['08:00'];
    times.forEach((_, slotIdx) => {
      for (let r = 0; r <= repeatCount; r++) {
        ids.push(reminderNotifId(reminder.id, slotIdx, r));
      }
    });
  } else if (reminder.frequency_type === 'specific_day_of_week') {
    const weekdays = reminder.frequency_config.weekdays ?? [];
    weekdays.forEach((_, slotIdx) => {
      for (let r = 0; r <= repeatCount; r++) {
        ids.push(reminderNotifId(reminder.id, slotIdx, r));
      }
    });
  } else {
    // interval, cyclic — single slot
    for (let r = 0; r <= repeatCount; r++) {
      ids.push(reminderNotifId(reminder.id, 0, r));
    }
  }

  return ids;
}

/**
 * Schedule a single time slot with escalating 5-minute repeat notifications.
 * @param reminderId - The reminder ID
 * @param slotIndex - Which time slot (0 for first daily time, 1 for second, etc.)
 * @param scheduledTime - The base scheduled time as Date
 * @param title - Notification title
 * @param body - Notification body
 * @param reminder - The full reminder object (for extra data)
 */
async function scheduleTimeSlotWithRepeats(
  reminderId: string,
  slotIndex: number,
  scheduledTime: Date,
  title: string,
  body: string,
  reminder: FinmedReminder,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const maxWindow = reminder.max_repeat_window_minutes ?? DEFAULT_MAX_REPEAT_WINDOW_MINUTES;
  const repeatCount = Math.ceil(maxWindow / REPEAT_INTERVAL_MINUTES);

  const toSchedule: any[] = [];

  // Schedule initial notification at scheduled time
  toSchedule.push({
    id: reminderNotifId(reminderId, slotIndex, 0),
    title,
    body,
    smallIcon: SMALL_ICON,
    largeIcon: LARGE_ICON,
    channelId: FINMED_INTAKE_CHANNEL,
    schedule: { at: scheduledTime, allowWhileIdle: true },
    extra: {
      reminderId,
      slotIndex,
      repeatIndex: 0,
      type: reminder.type,
    },
    actionTypeId: 'INTAKE_ACTIONS',
  });

  // Schedule repeat notifications every 5 minutes after scheduled time
  for (let i = 1; i <= repeatCount; i++) {
    const repeatTime = new Date(scheduledTime.getTime() + i * REPEAT_INTERVAL_MINUTES * 60 * 1000);
    toSchedule.push({
      id: reminderNotifId(reminderId, slotIndex, i),
      title,
      body: i === repeatCount ? `${body} (final reminder)` : body,
      smallIcon: SMALL_ICON,
      largeIcon: LARGE_ICON,
      channelId: FINMED_INTAKE_CHANNEL,
      schedule: { at: repeatTime, allowWhileIdle: true },
      extra: {
        reminderId,
        slotIndex,
        repeatIndex: i,
        type: reminder.type,
      },
      actionTypeId: 'INTAKE_ACTIONS',
    });
  }

  await LocalNotifications.schedule({ notifications: toSchedule });

  // Log all scheduled notifications
  toSchedule.forEach((notif) => {
    logNotif('SCHEDULED', {
      module: 'finmed',
      type: 'intake_reminder',
      id: notif.id,
      title: notif.title,
      body: notif.body,
      scheduledAt: notif.schedule.at.toISOString(),
      extra: notif.extra,
      channelId: notif.channelId,
    });
  });
}

/**
 * Cancel all notifications for a specific reminder time slot.
 * @param reminderId - The reminder ID
 * @param slotIndex - Which time slot to cancel
 * @param maxWindow - Max repeat window in minutes
 */
export async function cancelReminderTimeSlot(
  reminderId: string,
  slotIndex: number,
  maxWindow = DEFAULT_MAX_REPEAT_WINDOW_MINUTES,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const repeatCount = Math.ceil(maxWindow / REPEAT_INTERVAL_MINUTES);
  const ids: number[] = [];

  for (let r = 0; r <= repeatCount; r++) {
    ids.push(reminderNotifId(reminderId, slotIndex, r));
  }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    // non-fatal
  }
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

export async function scheduleIntakeReminder(
  reminder: FinmedReminder,
  options?: { mirror?: boolean },
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!reminder.active || reminder.frequency_type === 'on_demand') return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') {
      const { display: after } = await LocalNotifications.requestPermissions();
      if (after !== 'granted') return;
    }

    const medConfig = readMedicationReminderConfig(reminder);
    const body = medConfig
      ? `${medConfig.doseAmount} ${medConfig.doseUnit} — time to take your medication`
      : 'Time for your reminder';

    if (reminder.frequency_type === 'multiple_times_daily') {
      // Schedule escalating notifications for each daily time
      const times = reminder.frequency_config.times ?? ['08:00'];
      const now = new Date();

      for (let i = 0; i < times.length; i++) {
        const [hour, minute] = times[i].split(':').map(Number);
        const scheduledTime = new Date();
        scheduledTime.setHours(hour, minute, 0, 0);

        // If time already passed today, schedule for tomorrow
        if (scheduledTime <= now) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }

        await scheduleTimeSlotWithRepeats(
          reminder.id,
          i,
          scheduledTime,
          reminder.label,
          body,
          reminder,
        );
      }
    } else if (reminder.frequency_type === 'interval') {
      // For interval reminders, schedule one time slot starting from now + interval
      const hours = reminder.frequency_config.interval_hours ?? 8;
      const scheduledTime = new Date(Date.now() + hours * 3_600_000);

      await scheduleTimeSlotWithRepeats(
        reminder.id,
        0,
        scheduledTime,
        reminder.label,
        body,
        reminder,
      );
    } else if (reminder.frequency_type === 'specific_day_of_week') {
      // Schedule for next occurrence of each weekday at 08:00
      const weekdays = reminder.frequency_config.weekdays ?? [];
      const now = new Date();

      for (let i = 0; i < weekdays.length; i++) {
        const targetWeekday = weekdays[i];
        const daysUntil = (targetWeekday - now.getDay() + 7) % 7 || 7;
        const scheduledTime = new Date(now);
        scheduledTime.setDate(scheduledTime.getDate() + daysUntil);
        scheduledTime.setHours(8, 0, 0, 0);

        await scheduleTimeSlotWithRepeats(
          reminder.id,
          i,
          scheduledTime,
          reminder.label,
          body,
          reminder,
        );
      }
    } else if (reminder.frequency_type === 'cyclic') {
      const at = nextCyclicIntakeDate(reminder);
      if (at) {
        await scheduleTimeSlotWithRepeats(
          reminder.id,
          0,
          at,
          reminder.label,
          body,
          reminder,
        );
      }
    }

    // By default, mirror to in-app center. Some callers (boot-time reschedule)
    // should schedule native notifications without creating duplicate feed records.
    if (options?.mirror !== false) {
      await mirrorNotification(
        'finmed_intake_reminder',
        reminder.label,
        body,
        {
          reminderId: reminder.id,
          medicationId: medConfig?.medicationId,
        },
      );
    }
  } catch {
    // non-fatal
  }
}

export async function cancelIntakeReminder(reminder: FinmedReminder): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const ids = allNotificationIds(reminder);
  if (ids.length === 0) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    // non-fatal
  }
}

/**
 * Reschedule notifications for a specific time slot after snooze.
 * Cancels existing notifications and schedules new batch from snoozed time.
 */
export async function rescheduleAfterSnooze(
  reminder: FinmedReminder,
  slotIndex: number,
  snoozedUntil: Date,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // Cancel existing notifications for this slot
  await cancelReminderTimeSlot(
    reminder.id,
    slotIndex,
    reminder.max_repeat_window_minutes ?? DEFAULT_MAX_REPEAT_WINDOW_MINUTES,
  );

  // Schedule new batch from snoozed time
  const medConfig = readMedicationReminderConfig(reminder);
  const body = medConfig
    ? `${medConfig.doseAmount} ${medConfig.doseUnit} — time to take your medication`
    : 'Time for your reminder';

  await scheduleTimeSlotWithRepeats(
    reminder.id,
    slotIndex,
    snoozedUntil,
    reminder.label,
    body,
    reminder,
  );

  // Mirror to in-app notification center
  await mirrorNotification(
    'finmed_intake_reminder',
    reminder.label,
    body,
    {
      reminderId: reminder.id,
      medicationId: medConfig?.medicationId,
    },
  );
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

    // Mirror to in-app notification center
    await mirrorNotification(
      'finmed_low_stock',
      `Low stock: ${medication.name}`,
      `Only ${medication.stock_quantity} ${medication.unit} remaining`,
      { medicationId: medication.id },
    );

    logNotif('SCHEDULED', {
      module: 'finmed',
      type: 'low_stock_alert',
      id,
      title: `Low stock: ${medication.name}`,
      body: `Only ${medication.stock_quantity} ${medication.unit} remaining`,
      scheduledAt: new Date(Date.now() + 500).toISOString(),
      extra: { medicationId: medication.id },
      channelId: FINMED_LOW_STOCK_CHANNEL,
    });
  } catch {
    // non-fatal
  }
}

/**
 * Setup notification action types with "Taken" and "Snooze" buttons.
 * Should be called once at app startup.
 */
export async function setupIntakeNotificationActions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'INTAKE_ACTIONS',
          actions: [
            {
              id: 'taken',
              title: 'Taken',
            },
            {
              id: 'snooze',
              title: 'Snooze',
            },
          ],
        },
      ],
    });
  } catch {
    // non-fatal
  }
}

/**
 * Setup notification action listener for intake reminders.
 * Handles "Taken" and "Snooze" actions from notification buttons, and "tap" for notification body.
 * Should be called once at app startup.
 *
 * @param onTaken - Callback when "Taken" is pressed. Receives (reminderId, slotIndex)
 * @param onSnooze - Callback when "Snooze" is pressed. Receives (reminderId, slotIndex)
 * @param onTap - Callback when notification body is tapped. Receives (reminderId, slotIndex)
 */
export function setupIntakeNotificationActionListener(
  onTaken: (reminderId: string, slotIndex: number) => void,
  onSnooze: (reminderId: string, slotIndex: number) => void,
  onTap: (reminderId: string, slotIndex: number) => void,
): void {
  if (!Capacitor.isNativePlatform()) return;

  import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
    LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const extra = event.notification.extra as
        | { reminderId?: string; slotIndex?: number; type?: string }
        | undefined;

      // Log action performed
      logNotif('ACTION', {
        module: 'finmed',
        actionId: event.actionId,
        notificationId: event.notification.id,
        title: event.notification.title,
        body: event.notification.body,
        extra,
      });

      // Only handle FinMed intake notifications
      if (!extra?.reminderId || extra.slotIndex === undefined) return;

      const actionId = event.actionId;

      if (actionId === 'taken') {
        onTaken(extra.reminderId, extra.slotIndex);
      } else if (actionId === 'snooze') {
        onSnooze(extra.reminderId, extra.slotIndex);
      } else if (actionId === 'tap') {
        onTap(extra.reminderId, extra.slotIndex);
      }
    }).catch(() => {});
  }).catch(() => {});
}

/**
 * Setup notification received listener for FinMed.
 * Logs when notifications are shown/received.
 * Should be called once at app startup.
 */
export function setupIntakeNotificationReceivedListener(): void {
  if (!Capacitor.isNativePlatform()) return;

  import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
    LocalNotifications.addListener('localNotificationReceived', (event) => {
      logNotif('RECEIVED', {
        module: 'finmed',
        notificationId: event.id,
        title: event.title,
        body: event.body,
        extra: event.extra,
      });
    }).catch(() => {});
  }).catch(() => {});
}

