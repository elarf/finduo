import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import type { User } from '@supabase/supabase-js';
import type { FinGoAsset, UsageEntry, UsageLog, UsageSource } from '../types/fingo';

export function useUsageLogs(user: User | null) {
  const [logs, setLogs] = useState<Record<string, UsageLog[]>>({});

  const loadLogs = useCallback(async (assetId: string) => {
    try {
      logAPI('supabase://usage_logs', { source: 'fingo.asset_accordion.usage_logs', action: 'loadLogs' });
      const { data, error } = await supabase
        .from('usage_logs')
        .select('*')
        .eq('asset_id', assetId)
        .order('recorded_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setLogs((prev) => ({ ...prev, [assetId]: (data ?? []) as UsageLog[] }));
    } catch {
      // non-fatal
    }
  }, []);

  const fetchLoggedExternalIds = useCallback(async (source: UsageSource): Promise<Set<string>> => {
    if (!user) return new Set();
    try {
      const { data } = await supabase
        .from('usage_logs')
        .select('external_id')
        .eq('source', source)
        .eq('recorded_by', user.id)
        .not('external_id', 'is', null);
      return new Set((data ?? []).map((r: { external_id: string | null }) => r.external_id).filter(Boolean) as string[]);
    } catch {
      return new Set();
    }
  }, [user]);

  const addUsageLog = useCallback(async (
    asset: FinGoAsset,
    entry: UsageEntry,
    linkedExpenseId?: string | null,
    source?: UsageSource,
    externalId?: string | null,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://usage_logs', { source: 'fingo.usage_log_modal.submit', action: 'addUsageLog' });

      // Determine primary metric → usage_delta / usage_after
      let usageDelta = 0;
      if (asset.type === 'shoe') {
        usageDelta = entry.steps ?? 0;
      } else {
        usageDelta = entry.distance ?? 0;
      }
      const usageAfter = asset.current_usage + usageDelta;

      const movingTimeMin = entry.movingTime ?? null;
      const elevationM = entry.elevation ?? null;

      // Read installed components BEFORE insert so our update is idempotent
      // with the DB trigger (if it exists): both write old_value + delta.
      const { data: installedComps } = await supabase
        .from('components')
        .select('id, track_distance, track_rides, track_moving_time, track_elapsed_time, track_elevation_gain')
        .eq('installed_on_asset_id', asset.id)
        .eq('status', 'installed');

      const { error: logError } = await supabase
        .from('usage_logs')
        .insert({
          asset_id: asset.id,
          recorded_by: user.id,
          usage_delta: usageDelta,
          usage_after: usageAfter,
          moving_time_delta: movingTimeMin,
          elevation_delta: elevationM,
          source: source ?? 'odometer',
          external_id: externalId ?? null,
          linked_expense_id: linkedExpenseId ?? null,
          notes: entry.notes ?? null,
        });
      if (logError) throw logError;

      // Build asset totals update
      const totalsUpdate: Record<string, number> = {
        current_usage: usageAfter,
      };
      if (asset.type === 'shoe') {
        totalsUpdate['total_steps'] = (asset.total_steps ?? 0) + usageDelta;
      } else {
        totalsUpdate['total_distance'] = (asset.total_distance ?? 0) + usageDelta;
        if (asset.type === 'bike') {
          totalsUpdate['total_rides'] = (asset.total_rides ?? 0) + 1;
          if (elevationM !== null) {
            totalsUpdate['total_elevation'] = (asset.total_elevation ?? 0) + elevationM;
          }
        }
        if (movingTimeMin !== null) {
          totalsUpdate['total_moving_time'] = (asset.total_moving_time ?? 0) + movingTimeMin;
        }
      }

      const { error: assetError } = await supabase
        .from('assets')
        .update(totalsUpdate)
        .eq('id', asset.id);
      if (assetError) throw assetError;

      // Update component tracking values directly (does not rely on DB trigger).
      // Uses pre-insert component values so the result equals old + delta even
      // if the trigger also fires for the same insert.
      if (installedComps && installedComps.length > 0) {
        const movingTimeHDelta = movingTimeMin != null ? movingTimeMin / 60.0 : 0;
        const elevationDelta = elevationM ?? 0;
        await Promise.all(
          installedComps.map((comp) =>
            supabase.from('components').update({
              track_distance:       comp.track_distance       + usageDelta,
              track_rides:          comp.track_rides          + 1,
              track_moving_time:    comp.track_moving_time    + movingTimeHDelta,
              track_elapsed_time:   comp.track_elapsed_time   + movingTimeHDelta,
              track_elevation_gain: comp.track_elevation_gain + elevationDelta,
            }).eq('id', comp.id),
          ),
        );
      }

      await loadLogs(asset.id);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to record usage');
      return false;
    }
  }, [user, loadLogs]);

  const deleteLog = useCallback(async (logId: string, assetId: string): Promise<boolean> => {
    try {
      logAPI('supabase://usage_logs', { source: 'fingo.asset_accordion.delete_log', action: 'deleteLog' });
      const { error } = await supabase
        .from('usage_logs')
        .delete()
        .eq('id', logId);
      if (error) throw error;
      await loadLogs(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to delete log');
      return false;
    }
  }, [loadLogs]);

  return { logs, loadLogs, addUsageLog, deleteLog, fetchLoggedExternalIds };
}
