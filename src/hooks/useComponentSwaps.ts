import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import { useAuth } from '../context/AuthContext';
import type { ComponentSwap, UsageLog } from '../types/fingo';

export function useComponentSwaps() {
  const { session } = useAuth();
  const user = session?.user ?? null;
  const [swaps, setSwaps] = useState<ComponentSwap[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSwaps = useCallback(async (componentId: string) => {
    setLoading(true);
    try {
      logAPI('supabase://component_swaps', { source: 'fingo.component_detail', action: 'loadSwaps' });
      const { data, error } = await supabase
        .from('component_swaps')
        .select('*, assets(name)')
        .eq('component_id', componentId)
        .order('installed_at', { ascending: false });
      if (error) throw error;
      const enriched = (data ?? []).map((row: any) => ({
        ...row,
        asset_name: row.assets?.name ?? undefined,
        assets: undefined,
      })) as ComponentSwap[];
      setSwaps(enriched);
    } catch (err) {
      console.warn('[useComponentSwaps] loadSwaps failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addSwap = useCallback(async (
    componentId: string,
    assetId: string | null,
    installedAt: string,
    removedAt?: string | null,
    notes?: string | null,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://component_swaps', { source: 'fingo.component_detail', action: 'addSwap' });
      const { error } = await supabase.from('component_swaps').insert({
        component_id: componentId,
        asset_id: assetId,
        installed_at: installedAt,
        removed_at: removedAt ?? null,
        notes: notes ?? null,
        created_by: user.id,
      });
      if (error) throw error;
      await loadSwaps(componentId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to add swap');
      return false;
    }
  }, [user, loadSwaps]);

  const updateSwap = useCallback(async (
    id: string,
    componentId: string,
    patch: Partial<Pick<ComponentSwap, 'installed_at' | 'removed_at' | 'notes'>>,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://component_swaps', { source: 'fingo.component_detail', action: 'updateSwap' });
      const { error } = await supabase.from('component_swaps').update(patch).eq('id', id);
      if (error) throw error;
      await loadSwaps(componentId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to update swap');
      return false;
    }
  }, [loadSwaps]);

  const deleteSwap = useCallback(async (id: string, componentId: string): Promise<boolean> => {
    try {
      logAPI('supabase://component_swaps', { source: 'fingo.component_detail', action: 'deleteSwap' });
      const { error } = await supabase.from('component_swaps').delete().eq('id', id);
      if (error) throw error;
      await loadSwaps(componentId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to delete swap');
      return false;
    }
  }, [loadSwaps]);

  return { swaps, loading, loadSwaps, addSwap, updateSwap, deleteSwap };
}

// ─── Speed calculation helpers ────────────────────────────────────────────────

/** km/h from distance in km and moving time in hours */
export function calcSpeedKmh(distanceKm: number, movingTimeHours: number): number {
  if (movingTimeHours <= 0) return 0;
  return distanceKm / movingTimeHours;
}

/**
 * Given usage logs, returns avg and max speed in km/h.
 * avgSpeed = total distance / total moving time.
 * maxSpeed = highest per-ride speed.
 * moving_time_delta is stored in minutes in usage_logs.
 */
export function calcSpeeds(logs: UsageLog[]): { avgSpeed: number; maxSpeed: number } {
  let totalDist = 0;
  let totalTimeH = 0;
  let maxSpeed = 0;

  for (const log of logs) {
    if (!log.moving_time_delta || log.moving_time_delta <= 0) continue;
    const timeH = log.moving_time_delta / 60;
    totalDist += log.usage_delta;
    totalTimeH += timeH;
    const speed = log.usage_delta / timeH;
    if (speed > maxSpeed) maxSpeed = speed;
  }

  const avgSpeed = totalTimeH > 0 ? totalDist / totalTimeH : 0;
  return { avgSpeed, maxSpeed };
}
