import { useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { useAssets } from './useAssets';
import { useUsageLogs } from './useUsageLogs';
import { runHCAutoAttach } from '../lib/fingo/hcAutoAttach';

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Syncs Health Connect data every hour while the app is in the foreground,
 * and again when the app is resumed from the background.
 * Only active on native platforms with Health Connect available.
 */
export function useHCAutoSync(): void {
  const { session } = useAuth();
  const user = session?.user ?? null;
  const { assets, loadAssets } = useAssets(user);
  const { addUsageLog, fetchLoggedExternalIds } = useUsageLogs(user);

  const lastSyncRef = useRef<number>(0);
  const isSyncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    if (isSyncingRef.current) return;
    if (assets.length === 0) return;

    isSyncingRef.current = true;
    try {
      await runHCAutoAttach(assets, addUsageLog, fetchLoggedExternalIds);
      lastSyncRef.current = Date.now();
    } catch {
      // non-fatal
    } finally {
      isSyncingRef.current = false;
    }
  }, [assets, addUsageLog, fetchLoggedExternalIds]);

  // Load assets once
  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  // Hourly timer while in foreground
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const timer = setInterval(() => { void sync(); }, SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [sync]);

  // Sync on app resume (foreground) — skip if synced recently
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeListener: (() => void) | undefined;
    import('@capacitor/app').then(({ App }) => {
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return;
        const elapsed = Date.now() - lastSyncRef.current;
        if (elapsed >= SYNC_INTERVAL_MS) void sync();
      }).then((handle) => { removeListener = () => handle.remove(); }).catch(() => {});
    }).catch(() => {});
    return () => removeListener?.();
  }, [sync]);
}
