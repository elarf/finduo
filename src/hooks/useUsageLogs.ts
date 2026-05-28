import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import { notifyDueIntervals } from '../lib/fingo/notifications';
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
        .order('recorded_at', { ascending: false });
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
        .select('id, name, track_distance, track_rides, track_moving_time, track_elapsed_time, track_elevation_gain')
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
          ...(entry.recordedAt ? { recorded_at: entry.recordedAt } : {}),
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
        const updatedComps = installedComps.map(c => ({
          ...c,
          track_distance:       c.track_distance       + usageDelta,
          track_rides:          c.track_rides          + 1,
          track_moving_time:    c.track_moving_time    + movingTimeHDelta,
          track_elapsed_time:   c.track_elapsed_time   + movingTimeHDelta,
          track_elevation_gain: c.track_elevation_gain + elevationDelta,
        }));
        notifyDueIntervals(installedComps.map(c => c.id), updatedComps, asset.id).catch(() => {});
      }

      await loadLogs(asset.id);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to record usage');
      return false;
    }
  }, [user, loadLogs]);

  const updateLog = useCallback(async (
    log: UsageLog,
    asset: FinGoAsset,
    entry: UsageEntry,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://usage_logs', { source: 'fingo.usage_log_modal.update', action: 'updateLog' });

      const newUsageDelta = asset.type === 'shoe'
        ? (entry.steps ?? log.usage_delta)
        : (entry.distance ?? log.usage_delta);
      const deltaDiff = newUsageDelta - log.usage_delta;
      const newMovingTime = entry.movingTime !== undefined ? (entry.movingTime ?? null) : (log.moving_time_delta ?? null);
      const newElevation = entry.elevation !== undefined ? (entry.elevation ?? null) : (log.elevation_delta ?? null);
      const movingTimeDiff = (newMovingTime ?? 0) - (log.moving_time_delta ?? 0);
      const elevationDiff = (newElevation ?? 0) - (log.elevation_delta ?? 0);

      const { error: logError } = await supabase
        .from('usage_logs')
        .update({
          usage_delta: newUsageDelta,
          usage_after: log.usage_after + deltaDiff,
          moving_time_delta: newMovingTime,
          elevation_delta: newElevation,
          notes: entry.notes !== undefined ? (entry.notes ?? null) : (log.notes ?? null),
          ...(entry.recordedAt ? { recorded_at: entry.recordedAt } : {}),
        })
        .eq('id', log.id);
      if (logError) throw logError;

      const totalsUpdate: Record<string, number> = {
        current_usage: asset.current_usage + deltaDiff,
      };
      if (asset.type === 'shoe') {
        totalsUpdate['total_steps'] = (asset.total_steps ?? 0) + deltaDiff;
      } else {
        totalsUpdate['total_distance'] = (asset.total_distance ?? 0) + deltaDiff;
        if (asset.type === 'bike' && elevationDiff !== 0) {
          totalsUpdate['total_elevation'] = (asset.total_elevation ?? 0) + elevationDiff;
        }
        if (movingTimeDiff !== 0) {
          totalsUpdate['total_moving_time'] = (asset.total_moving_time ?? 0) + movingTimeDiff;
        }
      }

      const { error: assetError } = await supabase
        .from('assets')
        .update(totalsUpdate)
        .eq('id', asset.id);
      if (assetError) throw assetError;

      // Update component tracking values to reflect the change
      const { data: installedComps } = await supabase
        .from('components')
        .select('id, track_distance, track_moving_time, track_elapsed_time, track_elevation_gain')
        .eq('installed_on_asset_id', asset.id)
        .eq('status', 'installed');

      if (installedComps && installedComps.length > 0 && (deltaDiff !== 0 || movingTimeDiff !== 0 || elevationDiff !== 0)) {
        const movingTimeHDiff = movingTimeDiff / 60.0;
        await Promise.all(
          installedComps.map((comp) =>
            supabase.from('components').update({
              track_distance:       Math.max(0, comp.track_distance       + deltaDiff),
              track_moving_time:    Math.max(0, comp.track_moving_time    + movingTimeHDiff),
              track_elapsed_time:   Math.max(0, comp.track_elapsed_time   + movingTimeHDiff),
              track_elevation_gain: Math.max(0, comp.track_elevation_gain + elevationDiff),
            }).eq('id', comp.id),
          ),
        );
      }

      await loadLogs(asset.id);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to update log');
      return false;
    }
  }, [loadLogs]);

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

  const deleteLogAndReverseAsset = useCallback(async (
    log: UsageLog,
    asset: FinGoAsset,
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.from('usage_logs').delete().eq('id', log.id);
      if (error) throw error;

      const totalsUpdate: Record<string, number> = {
        current_usage: Math.max(0, asset.current_usage - log.usage_delta),
      };
      if (asset.type === 'shoe') {
        totalsUpdate['total_steps'] = Math.max(0, asset.total_steps - log.usage_delta);
      } else {
        totalsUpdate['total_distance'] = Math.max(0, asset.total_distance - log.usage_delta);
        if (asset.type === 'bike') {
          totalsUpdate['total_rides'] = Math.max(0, asset.total_rides - 1);
          if (log.elevation_delta != null) {
            totalsUpdate['total_elevation'] = Math.max(0, asset.total_elevation - log.elevation_delta);
          }
        }
        if (log.moving_time_delta != null) {
          totalsUpdate['total_moving_time'] = Math.max(0, asset.total_moving_time - log.moving_time_delta);
        }
      }
      await supabase.from('assets').update(totalsUpdate).eq('id', asset.id);

      const { data: installedComps } = await supabase
        .from('components')
        .select('id, track_distance, track_rides, track_moving_time, track_elapsed_time, track_elevation_gain')
        .eq('installed_on_asset_id', asset.id)
        .eq('status', 'installed');
      if (installedComps && installedComps.length > 0) {
        const movingTimeH = (log.moving_time_delta ?? 0) / 60.0;
        const elev = log.elevation_delta ?? 0;
        await Promise.all(
          installedComps.map((comp) =>
            supabase.from('components').update({
              track_distance:       Math.max(0, comp.track_distance       - log.usage_delta),
              track_rides:          Math.max(0, comp.track_rides          - 1),
              track_moving_time:    Math.max(0, comp.track_moving_time    - movingTimeH),
              track_elapsed_time:   Math.max(0, comp.track_elapsed_time   - movingTimeH),
              track_elevation_gain: Math.max(0, comp.track_elevation_gain - elev),
            }).eq('id', comp.id),
          ),
        );
      }
      await loadLogs(asset.id);
      return true;
    } catch {
      return false;
    }
  }, [loadLogs]);

  const pruneHCDuplicateLogs = useCallback(async (asset: FinGoAsset): Promise<number> => {
    if (!user) return 0;
    try {
      const { data: freshData } = await supabase
        .from('assets').select('*').eq('id', asset.id).single();
      if (!freshData) return 0;

      const { data: hcLogs } = await supabase
        .from('usage_logs')
        .select('*')
        .eq('asset_id', asset.id)
        .eq('source', 'health_connect')
        .order('recorded_at', { ascending: false });
      const logs = (hcLogs ?? []) as UsageLog[];
      if (logs.length <= 1) return 0;

      const toDelete = new Set<string>();
      for (let i = 0; i < logs.length; i++) {
        if (toDelete.has(logs[i]!.id)) continue;
        for (let j = i + 1; j < logs.length; j++) {
          if (toDelete.has(logs[j]!.id)) continue;
          const a = logs[i]!;
          const b = logs[j]!;
          const timeDiff = Math.abs(
            new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
          );
          if (timeDiff > 4 * 60 * 60 * 1000) continue;

          const aDur = a.moving_time_delta ?? 0;
          const bDur = b.moving_time_delta ?? 0;
          if (aDur > 0 && bDur > 0) {
            const durationDiff = Math.abs(aDur - bDur);
            if (durationDiff > Math.max(5, Math.min(aDur, bDur) * 0.1)) continue;
          }

          const aDist = a.usage_delta;
          const bDist = b.usage_delta;
          if (aDist > 0 && bDist > 0) {
            const distDiff = Math.abs(aDist - bDist);
            if (distDiff > Math.max(0.5, Math.min(aDist, bDist) * 0.1)) continue;
          }

          if (aDist >= bDist && (aDist > bDist || aDur >= bDur)) {
            toDelete.add(b.id);
          } else {
            toDelete.add(a.id);
          }
        }
      }

      if (toDelete.size === 0) return 0;

      let pruned = 0;
      let runningAsset = freshData as FinGoAsset;
      for (const logId of toDelete) {
        const log = logs.find((l) => l.id === logId);
        if (!log) continue;
        const ok = await deleteLogAndReverseAsset(log, runningAsset);
        if (ok) {
          runningAsset = {
            ...runningAsset,
            current_usage: Math.max(0, runningAsset.current_usage - log.usage_delta),
            total_steps: Math.max(0, runningAsset.total_steps - (asset.type === 'shoe' ? log.usage_delta : 0)),
            total_distance: Math.max(0, runningAsset.total_distance - (asset.type !== 'shoe' ? log.usage_delta : 0)),
            total_rides: asset.type === 'bike' ? Math.max(0, runningAsset.total_rides - 1) : runningAsset.total_rides,
            total_moving_time: Math.max(0, runningAsset.total_moving_time - (log.moving_time_delta ?? 0)),
            total_elevation: Math.max(0, runningAsset.total_elevation - (log.elevation_delta ?? 0)),
          };
          pruned++;
        }
      }
      return pruned;
    } catch {
      return 0;
    }
  }, [user, deleteLogAndReverseAsset]);

  return { logs, loadLogs, addUsageLog, updateLog, deleteLog, deleteLogAndReverseAsset, pruneHCDuplicateLogs, fetchLoggedExternalIds };
}
