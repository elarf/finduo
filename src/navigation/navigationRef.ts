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

