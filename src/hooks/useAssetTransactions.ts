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

      // Direct category matches
      const { data: directData, error: directError } = await supabase
        .from('transactions')
        .select('*')
        .in('category_id', categoryIds)
        .order('date', { ascending: false });
      if (directError) throw directError;
      const directTxs = (directData ?? []).map((t: any) => ({ ...t, tag_ids: t.tag_ids ?? [] })) as AppTransaction[];
      const directIds = new Set(directTxs.map((t) => t.id));

      // Split-sourced: transactions where a split references a linked category
      logAPI('supabase://transaction_splits', { source: 'fingo.asset_accordion.stats', action: 'loadSplitMatches' });
      const { data: splitsData, error: splitsError } = await supabase
        .from('transaction_splits')
        .select('parent_transaction_id, category_id, amount')
        .in('category_id', categoryIds);
      if (splitsError) {
        if (isMissingTableError(splitsError)) {
          setTransactions((prev) => ({ ...prev, [assetId]: directTxs }));
          return;
        }
        throw splitsError;
      }

      // Sum split amounts per parent (in case multiple splits from same tx match)
      const splitAmounts: Record<string, number> = {};
      for (const s of splitsData ?? []) {
        splitAmounts[s.parent_transaction_id] = (splitAmounts[s.parent_transaction_id] ?? 0) + s.amount;
      }

      const parentIds = Object.keys(splitAmounts).filter((id) => !directIds.has(id));
      let splitParentTxs: AppTransaction[] = [];
      if (parentIds.length > 0) {
        const { data: parentData, error: parentError } = await supabase
          .from('transactions')
          .select('*')
          .in('id', parentIds);
        if (parentError) throw parentError;
        splitParentTxs = (parentData ?? []).map((t: any) => ({
          ...t,
          tag_ids: t.tag_ids ?? [],
          amount: splitAmounts[t.id] ?? t.amount,
        })) as AppTransaction[];
      }

      const all = [...directTxs, ...splitParentTxs].sort((a, b) =>
        a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
      );
      setTransactions((prev) => ({ ...prev, [assetId]: all }));
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
