import { Platform } from 'react-native';
import { App as CapApp } from '@capacitor/app';
import { navigationRef } from '../navigation/navigationRef';

type Handler = () => boolean;

const _handlers: Handler[] = [];
let _initialized = false;

/**
 * Wire up Capacitor's backButton event once.
 * On Android Capacitor builds, the hardware back button doesn't interact
 * with React Navigation's in-memory stack by default — this bridges the gap.
 *
 * Priority order (first truthy result wins):
 *   1. Registered handlers, LIFO — e.g. FinGo internal modals, dashboard sections
 *   2. Navigation stack — dismisses nav-route modals (QuickNav, Entry, Transfer)
 *      and pops regular screens (FinGo → Dashboard)
 *   3. Minimize app
 */
export function initCapacitorBackButton(): void {
  if (_initialized || Platform.OS !== 'web') return;
  _initialized = true;

  void CapApp.addListener('backButton', () => {
    for (let i = _handlers.length - 1; i >= 0; i--) {
      if (_handlers[i]()) return;
    }
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
      return;
    }
    void CapApp.minimizeApp();
  });
}

/** Register a back-button handler. Returns an unregister function. */
export function registerBackHandler(handler: Handler): () => void {
  _handlers.push(handler);
  return () => {
    const idx = _handlers.lastIndexOf(handler);
    if (idx !== -1) _handlers.splice(idx, 1);
  };
}
