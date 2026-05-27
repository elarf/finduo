import { useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { writeHCSyncSnapshot } from '../lib/fingo/hcSyncNative';
import type {
  FinGoAsset, Component, ComponentServiceInterval,
  FinGoSyncSnapshot, FinGoSyncSnapshotAsset, FinGoSyncSnapshotComponent,
} from '../types/fingo';

function buildSnapshot(
  assets: FinGoAsset[],
  componentsByAsset: Record<string, Component[]>,
  intervals: Record<string, ComponentServiceInterval[]>,
): FinGoSyncSnapshot {
  const snapshotAssets: FinGoSyncSnapshotAsset[] = [];

  for (const asset of assets) {
    const components = componentsByAsset[asset.id] ?? [];
    const installedComponents = components.filter(
      (c) => c.status === 'installed' && c.installed_on_asset_id === asset.id,
    );

    if (installedComponents.length === 0) continue;

    const snapshotComponents: FinGoSyncSnapshotComponent[] = [];
    for (const comp of installedComponents) {
      const compIntervals = intervals[comp.id] ?? [];
      if (compIntervals.length === 0) continue;
      snapshotComponents.push({
        id: comp.id,
        name: comp.name,
        track_distance: comp.track_distance,
        track_moving_time: comp.track_moving_time,
        track_rides: comp.track_rides,
        track_elevation_gain: comp.track_elevation_gain,
        intervals: compIntervals.map((iv) => ({
          id: iv.id,
          name: iv.name,
          tracking_method: iv.tracking_method,
          interval_value: iv.interval_value,
          last_serviced_value: iv.last_serviced_value,
        })),
      });
    }

    if (snapshotComponents.length === 0) continue;
    snapshotAssets.push({ id: asset.id, name: asset.name, type: asset.type, components: snapshotComponents });
  }

  return { snapshotAt: Date.now(), assets: snapshotAssets };
}

export function useFinGoSnapshot(
  assets: FinGoAsset[],
  componentsByAsset: Record<string, Component[]>,
  intervals: Record<string, ComponentServiceInterval[]>,
): { refreshSnapshot: () => void } {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const writeSnapshot = useCallback(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (assets.length === 0) return;
    const snapshot = buildSnapshot(assets, componentsByAsset, intervals);
    if (snapshot.assets.length === 0) return;
    void writeHCSyncSnapshot(snapshot);
  }, [assets, componentsByAsset, intervals]);

  const refreshSnapshot = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(writeSnapshot, 200);
  }, [writeSnapshot]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(writeSnapshot, 2000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [writeSnapshot]);

  return { refreshSnapshot };
}
