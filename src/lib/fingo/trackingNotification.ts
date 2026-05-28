import { Capacitor } from '@capacitor/core';
import { ForegroundTimer } from '../../plugins/foregroundTimer';

export const TRACKING_CHANNEL_ID = 'fingo_tracking';

type TrackingActionCallbacks = {
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

let activeCallbacks: TrackingActionCallbacks | null = null;
let pendingAction: string | null = null;
let serviceStarted = false;

function dispatchAction(action: string) {
  if (!activeCallbacks) return;
  if (action === 'pause') activeCallbacks.onPause();
  if (action === 'resume') activeCallbacks.onResume();
  if (action === 'stop') activeCallbacks.onStop();
}

export function registerTrackingCallbacks(cbs: TrackingActionCallbacks) {
  activeCallbacks = cbs;
  if (pendingAction) {
    const action = pendingAction;
    pendingAction = null;
    dispatchAction(action);
  }
}

export function unregisterTrackingCallbacks() {
  activeCallbacks = null;
}

// No-op: channel is created in TrackingForegroundService.kt
export async function setupTrackingChannel(): Promise<void> {}

export async function showTrackingNotification(
  state: 'active' | 'paused',
  elapsedMs: number,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!serviceStarted) {
    await ForegroundTimer.start({ elapsedMs, state });
    serviceStarted = true;
  } else {
    await ForegroundTimer.update({ elapsedMs, state });
  }
}

export async function cancelTrackingNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await ForegroundTimer.stop();
  serviceStarted = false;
}

export function setupTrackingActionListener(): void {
  if (!Capacitor.isNativePlatform()) return;
  ForegroundTimer.addListener('actionPerformed', ({ action }) => {
    if (activeCallbacks) {
      dispatchAction(action);
    } else {
      pendingAction = action;
    }
  }).catch(() => {});
}
