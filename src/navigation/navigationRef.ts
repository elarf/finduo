import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './index';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Track if a shortcut is being processed
export let pendingShortcutId: string | null = null;

export function setPendingShortcut(id: string | null) {
  pendingShortcutId = id;
}

export function getPendingShortcut(): string | null {
  return pendingShortcutId;
}

// Track a notification tap that arrived before navigation was ready
export type PendingNotification = { intervalId: string; componentId: string; assetId: string };
let pendingNotification: PendingNotification | null = null;

export function setPendingNotification(n: PendingNotification | null) {
  pendingNotification = n;
}

export function getPendingNotification(): PendingNotification | null {
  return pendingNotification;
}

