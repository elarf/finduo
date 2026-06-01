import type { NotificationSource, InAppNotification } from './types';

type PushFunction = (
  source: NotificationSource,
  title: string,
  body: string,
  metadata?: InAppNotification['metadata'],
) => Promise<void>;

let pushNotificationFn: PushFunction | null = null;

export function initNotificationBridge(pushFn: PushFunction): void {
  pushNotificationFn = pushFn;
}

export async function mirrorNotification(
  source: NotificationSource,
  title: string,
  body: string,
  metadata?: InAppNotification['metadata'],
): Promise<void> {
  if (pushNotificationFn) {
    try {
      await pushNotificationFn(source, title, body, metadata);
    } catch (err) {
      console.error('[NotificationBridge] Mirror failed:', err);
    }
  }
}
