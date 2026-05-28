import { supabase } from '../supabase';
import type { Component, ComponentSwap, UsageLog } from '../../types/fingo';

/**
 * Filters usage logs to only those that fall within a component's installation periods.
 * Considers component swap history to determine when the component was actually installed.
 */
function filterLogsForComponent(
  logs: UsageLog[],
  installedAt: string | null,
  swaps: ComponentSwap[],
): UsageLog[] {
  if (swaps.length === 0) {
    // No swap history recorded yet — show logs from current installation date onwards
    if (!installedAt) return [];
    const since = new Date(installedAt);
    return logs.filter((l) => new Date(l.recorded_at) >= since);
  }
  return logs.filter((log) =>
    swaps.some((s) => {
      const logDate = new Date(log.recorded_at);
      const installedDate = new Date(s.installed_at);
      const removedDate = s.removed_at ? new Date(s.removed_at) : null;
      return logDate >= installedDate && (!removedDate || logDate <= removedDate);
    }),
  );
}

/**
 * Recalculates and updates a component's tracking totals based on all usage logs
 * that occurred while the component was installed, considering swap history.
 *
 * This is used when:
 * - A component is newly created with a historical installation date
 * - A component's installed_at date is changed
 * - "Since beginning" is enabled (installed_at = asset's created_at)
 *
 * @param componentId The component ID to update
 * @param assetId The asset ID the component is installed on
 * @param installedAt The component's installation timestamp
 * @returns True if successful, false otherwise
 */
export async function recalculateComponentTracking(
  componentId: string,
  assetId: string,
  installedAt: string,
): Promise<boolean> {
  try {
    // Fetch component swap history
    const { data: swapsData, error: swapsError } = await supabase
      .from('component_swaps')
      .select('*')
      .eq('component_id', componentId)
      .order('installed_at', { ascending: true });

    if (swapsError) throw swapsError;

    const swaps = (swapsData ?? []) as ComponentSwap[];

    // Fetch all usage logs for this asset
    const { data: logs, error: logsError } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('asset_id', assetId)
      .order('recorded_at', { ascending: true });

    if (logsError) throw logsError;

    const allLogs = (logs ?? []) as UsageLog[];

    // Filter logs using the same logic as the UI
    const usageLogs = filterLogsForComponent(allLogs, installedAt, swaps);

    // Calculate totals from filtered logs
    let totalDistance = 0;
    let totalMovingTimeH = 0;
    let totalElapsedTimeH = 0;
    let totalRides = 0;
    let totalElevationGain = 0;

    for (const log of usageLogs) {
      totalDistance += log.usage_delta ?? 0;
      const movingTimeMin = log.moving_time_delta ?? 0;
      totalMovingTimeH += movingTimeMin / 60.0;
      totalElapsedTimeH += movingTimeMin / 60.0; // For now, elapsed = moving
      totalRides += 1;
      totalElevationGain += log.elevation_delta ?? 0;
    }

    // Update component tracking fields
    const { error: updateError } = await supabase
      .from('components')
      .update({
        track_distance: totalDistance,
        track_moving_time: totalMovingTimeH,
        track_elapsed_time: totalElapsedTimeH,
        track_rides: totalRides,
        track_elevation_gain: totalElevationGain,
      })
      .eq('id', componentId);

    if (updateError) throw updateError;

    console.log(`Recalculated component ${componentId}: ${totalDistance}km, ${totalRides} rides from ${usageLogs.length} logs`);

    return true;
  } catch (err) {
    console.error('Failed to recalculate component tracking:', err);
    return false;
  }
}

/**
 * Recalculates tracking for multiple components at once.
 * Useful when syncing multiple components for the same asset.
 *
 * @param components Array of components with their asset IDs and installed_at dates
 * @returns Number of successfully updated components
 */
export async function recalculateMultipleComponents(
  components: Array<{ id: string; assetId: string; installedAt: string }>,
): Promise<number> {
  let successCount = 0;
  await Promise.all(
    components.map(async (comp) => {
      const success = await recalculateComponentTracking(comp.id, comp.assetId, comp.installedAt);
      if (success) successCount++;
    }),
  );
  return successCount;
}
