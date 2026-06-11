import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InAppNotification, NotificationStore } from './types';

const STORAGE_KEY = '@finduo/notifications';
const MAX_NOTIFICATIONS = 100;

export async function loadNotifications(): Promise<InAppNotification[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    const store: NotificationStore = JSON.parse(json);
    
    // Migrate legacy synthetic: prefixes to live:
    const migrated = store.notifications.map((n) => ({
      ...n,
      id: n.id
        .replace(/^synthetic:fingo:/, 'live:fingo:')
        .replace(/^synthetic:finmed:(.+)$/, (_, rest) =>
          `live:finmed:${rest.includes(':') ? rest : `${rest}:na`}`
        ),
    }));
    
    return migrated;
  } catch (err) {
    console.error('[NotificationStorage] Load failed:', err);
    return [];
  }
}

export async function saveNotifications(notifications: InAppNotification[]): Promise<void> {
  try {
    // Keep only most recent MAX_NOTIFICATIONS
    const trimmed = notifications
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, MAX_NOTIFICATIONS);

    const store: NotificationStore = {
      notifications: trimmed,
      unreadCount: trimmed.filter((n) => !n.isRead).length,
      lastUpdated: new Date().toISOString(),
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.error('[NotificationStorage] Save failed:', err);
  }
}

export async function clearAllNotifications(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('[NotificationStorage] Clear failed:', err);
  }
}
