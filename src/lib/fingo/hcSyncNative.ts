import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';
import type { FinGoSyncSnapshot } from '../../types/fingo';

interface HCSyncPlugin {
  scheduleSync(): Promise<void>;
  cancelSync(): Promise<void>;
  readPendingSync(): Promise<{
    pendingSyncAt: number;
    sessions: string;
    steps: string;
  }>;
  writeSnapshot(options: { snapshot: string }): Promise<void>;
}

const HCSyncPlugin = registerPlugin<HCSyncPlugin>('HCSyncPlugin', {
  web: {
    scheduleSync: async () => {},
    cancelSync: async () => {},
    readPendingSync: async () => ({ pendingSyncAt: 0, sessions: '[]', steps: '[]' }),
    writeSnapshot: async () => {},
  },
});

export async function scheduleNativeHCSync(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await HCSyncPlugin.scheduleSync();
}

export async function cancelNativeHCSync(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await HCSyncPlugin.cancelSync();
}

/**
 * Returns a timestamp (ms) if the background worker ran since the last JS sync,
 * and clears the flag from native storage. Returns 0 if nothing is pending.
 */
export async function drainPendingSyncFlag(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  const { pendingSyncAt } = await HCSyncPlugin.readPendingSync();
  return pendingSyncAt;
}

/**
 * Writes a snapshot of component tracking state to native SharedPreferences
 * so the background WorkManager job can check service intervals without the app open.
 */
export async function writeHCSyncSnapshot(snapshot: FinGoSyncSnapshot): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await HCSyncPlugin.writeSnapshot({ snapshot: JSON.stringify(snapshot) });
}
