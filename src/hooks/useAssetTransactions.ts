import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import { isMissingTableError } from '../types/dashboard';
import type { AppTransaction } from '../types/dashboard';
import type { AssetCategory } from '../types/fingo';

/**
 * Manages the asset ↔ FinDuo category links and fetches transactions
 * that belong to those categories (for asset statistics display).
 */
export function useAssetTransactions() {
  const [categoryLinks, setCategoryLinks] = useState<Record<string, string[]>>({});
  const [transactions, setTransactions] = useState<Record<string, AppTransaction[]>>({});

  const loadCategoryLinks = useCallback(async (assetId: string) => {
    try {
      logAPI('supabase://asset_categories', { source: 'fingo.asset_accordion.categories', action: 'loadCategoryLinks' });
      const { data, error } = await supabase
        .from('asset_categories')
        .select('category_id')
        .eq('asset_id', assetId);
      if (error) throw error;
      const ids = (data ?? []).map((r: AssetCategory) => r.category_id);
      setCategoryLinks((prev) => ({ ...prev, [assetId]: ids }));
      return ids;
    } catch {
      return [];
    }
  }, []);

  const loadTransactions = useCallback(async (assetId: string, categoryIds: string[]) => {
    if (categoryIds.length === 0) {
      setTransactions((prev) => ({ ...prev, [assetId]: [] }));
      return;
    }
    try {
      logAPI('supabase://transactions', { source: 'fingo.asset_accordion.stats', action: 'loadAssetTransactions' });
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .in('category_id', categoryIds)
        .order('date', { ascending: false });
      if (error) throw error;
      setTransactions((prev) => ({ ...prev, [assetId]: (data ?? []) as AppTransaction[] }));
    } catch {
      // non-fatal
    }
  }, []);

  const loadAssetStats = useCallback(async (assetId: string) => {
    const ids = await loadCategoryLinks(assetId);
    await loadTransactions(assetId, ids);
  }, [loadCategoryLinks, loadTransactions]);

  const linkCategory = useCallback(async (assetId: string, categoryId: string): Promise<boolean> => {
    try {
      logAPI('supabase://asset_categories', { source: 'fingo.category_picker.link', action: 'linkCategory' });
      const { error } = await supabase
        .from('asset_categories')
        .insert({ asset_id: assetId, category_id: categoryId });
      if (error) throw error;
      await loadAssetStats(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to link category');
      return false;
    }
  }, [loadAssetStats]);

  const unlinkCategory = useCallback(async (assetId: string, categoryId: string): Promise<boolean> => {
    try {
      logAPI('supabase://asset_categories', { source: 'fingo.category_picker.unlink', action: 'unlinkCategory' });
      const { error } = await supabase
        .from('asset_categories')
        .delete()
        .eq('asset_id', assetId)
        .eq('category_id', categoryId);
      if (error) throw error;
      await loadAssetStats(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to unlink category');
      return false;
    }
  }, [loadAssetStats]);

  return {
    categoryLinks,
    transactions,
    loadAssetStats,
    loadCategoryLinks,
    linkCategory,
    unlinkCategory,
  };
}
