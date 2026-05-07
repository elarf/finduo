import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import { isMissingTableError } from '../types/dashboard';
import type { AssetPart } from '../types/fingo';

export function useAssetParts() {
  const [parts, setParts] = useState<Record<string, AssetPart[]>>({});

  const loadParts = useCallback(async (assetId: string) => {
    try {
      logAPI('supabase://asset_parts', { source: 'fingo.asset_accordion.parts', action: 'loadParts' });
      const { data, error } = await supabase
        .from('asset_parts')
        .select('*')
        .eq('asset_id', assetId)
        .order('priority', { ascending: false });
      if (error) throw error;
      setParts((prev) => ({ ...prev, [assetId]: (data ?? []) as AssetPart[] }));
    } catch {
      // non-fatal
    }
  }, []);

  const createPart = useCallback(async (
    assetId: string,
    name: string,
    usageUnit: string,
    resetInterval: number,
    currentAssetUsage: number,
    priority = 5,
    warnAtPct = 0.8,
    notes?: string | null,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://asset_parts', { source: 'fingo.asset_accordion.add_part', action: 'createPart' });
      const { error } = await supabase
        .from('asset_parts')
        .insert({
          asset_id: assetId,
          name,
          usage_unit: usageUnit,
          reset_interval: resetInterval,
          usage_at_last_reset: currentAssetUsage,
          priority,
          warn_at_pct: warnAtPct,
          notes: notes ?? null,
        });
      if (error) throw error;
      await loadParts(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to create part');
      return false;
    }
  }, [loadParts]);

  const updatePart = useCallback(async (
    partId: string,
    assetId: string,
    patch: Partial<Pick<AssetPart, 'name' | 'usage_unit' | 'reset_interval' | 'priority' | 'warn_at_pct' | 'notes'>>,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://asset_parts', { source: 'fingo.asset_accordion.edit_part', action: 'updatePart' });
      const { error } = await supabase
        .from('asset_parts')
        .update(patch)
        .eq('id', partId);
      if (error) throw error;
      await loadParts(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to update part');
      return false;
    }
  }, [loadParts]);

  const deletePart = useCallback(async (partId: string, assetId: string): Promise<boolean> => {
    try {
      logAPI('supabase://asset_parts', { source: 'fingo.asset_accordion.delete_part', action: 'deletePart' });
      const { error } = await supabase
        .from('asset_parts')
        .delete()
        .eq('id', partId);
      if (error) throw error;
      await loadParts(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to delete part');
      return false;
    }
  }, [loadParts]);

  /**
   * Mark a part as serviced — updates usage_at_last_reset to the current asset usage
   * and writes a part_service_log entry.
   */
  const servicePart = useCallback(async (
    partId: string,
    assetId: string,
    currentAssetUsage: number,
    linkedExpenseId?: string | null,
    notes?: string | null,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://asset_parts', { source: 'fingo.part_health_bar.service_button', action: 'servicePart' });
      const { error: partError } = await supabase
        .from('asset_parts')
        .update({ usage_at_last_reset: currentAssetUsage })
        .eq('id', partId);
      if (partError) throw partError;

      const { error: logError } = await supabase
        .from('part_service_logs')
        .insert({
          part_id: partId,
          usage_at_service: currentAssetUsage,
          linked_expense_id: linkedExpenseId ?? null,
          notes: notes ?? null,
        });
      if (logError) throw logError;

      await loadParts(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to record service');
      return false;
    }
  }, [loadParts]);

  return { parts, loadParts, createPart, updatePart, deletePart, servicePart };
}
