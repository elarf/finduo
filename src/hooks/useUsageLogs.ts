import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import type { User } from '@supabase/supabase-js';
import type { FinGoAsset, UsageEntry, UsageLog } from '../types/fingo';

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

  const addUsageLog = useCallback(async (
    asset: FinGoAsset,
    entry: UsageEntry,
    linkedExpenseId?: string | null,
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

      const { error: logError } = await supabase
        .from('usage_logs')
        .insert({
          asset_id: asset.id,
          recorded_by: user.id,
          usage_delta: usageDelta,
          usage_after: usageAfter,
          moving_time_delta: movingTimeMin,
          elevation_delta: elevationM,
          source: 'odometer',
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

  return { logs, loadLogs, addUsageLog, deleteLog };
}
