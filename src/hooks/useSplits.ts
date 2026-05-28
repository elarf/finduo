import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import { isMissingTableError } from '../types/dashboard';
import type { TransactionSplit } from '../types/dashboard';

export const splitsQueryKey = (transactionId: string) =>
  ['splits', transactionId] as const;

export const splitsBatchQueryKey = (sortedIds: string) =>
  ['splits_batch', sortedIds] as const;

async function fetchSplitsForTransaction(transactionId: string): Promise<TransactionSplit[]> {
  logAPI('supabase://transaction_splits', { source: 'useSplits', action: 'loadSplits' });
  const { data, error } = await supabase
    .from('transaction_splits')
    .select('*, category:categories(id,name,color,icon,type,user_id,account_id,tag_ids,is_default,temp_for)')
    .eq('parent_transaction_id', transactionId)
    .order('created_at', { ascending: true });
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data ?? []) as TransactionSplit[];
}

/** Single-transaction query — used by TransactionRow when has_splits=true. */
export function useSplitsForTransaction(transactionId: string | null) {
  return useQuery({
    queryKey: splitsQueryKey(transactionId ?? ''),
    queryFn: () => fetchSplitsForTransaction(transactionId!),
    enabled: !!transactionId,
  });
}

/** Batch query — used by DashboardContext for split-aware category totals. */
export function useSplitsBatch(transactionIds: string[]) {
  const sortedIds = [...transactionIds].sort().join(',');
  return useQuery({
    queryKey: splitsBatchQueryKey(sortedIds),
    queryFn: async (): Promise<TransactionSplit[]> => {
      if (transactionIds.length === 0) return [];
      logAPI('supabase://transaction_splits', { source: 'useSplits.batch', action: 'batchLoad' });
      const { data, error } = await supabase
        .from('transaction_splits')
        .select('*, category:categories(id,name,color,icon,type,user_id,account_id,tag_ids,is_default,temp_for)')
        .in('parent_transaction_id', transactionIds);
      if (error) {
        if (isMissingTableError(error)) return [];
        throw error;
      }
      return (data ?? []) as TransactionSplit[];
    },
    enabled: transactionIds.length > 0,
    staleTime: 30_000,
  });
}

export function useSplits() {
  const queryClient = useQueryClient();

  const loadSplitsForTransaction = useCallback(
    (transactionId: string) => fetchSplitsForTransaction(transactionId),
    [],
  );

  /**
   * Replace-all strategy: delete existing splits for this parent, then insert the new set.
   * Application-layer enforces: sum(splits) ≤ parent.amount.
   */
  const saveSplits = useCallback(async (
    parentTransactionId: string,
    splits: Omit<TransactionSplit, 'id' | 'created_at'>[],
  ): Promise<void> => {
    try {
      logAPI('supabase://transaction_splits', { source: 'useSplits', action: 'saveSplits' });
      // Delete existing
      const { error: delError } = await supabase
        .from('transaction_splits')
        .delete()
        .eq('parent_transaction_id', parentTransactionId);
      if (delError) throw delError;

      if (splits.length > 0) {
        const { error: insError } = await supabase
          .from('transaction_splits')
          .insert(splits.map((s) => ({
            parent_transaction_id: parentTransactionId,
            category_id: s.category_id,
            amount: s.amount,
            note: s.note ?? null,
            user_id: s.user_id,
          })));
        if (insError) throw insError;
      }

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: splitsQueryKey(parentTransactionId) });
      await queryClient.invalidateQueries({ queryKey: ['splits_batch'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['assetTransactions'] });
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to save splits');
      throw err;
    }
  }, [queryClient]);

  const deleteSplitsForTransaction = useCallback(async (transactionId: string): Promise<void> => {
    try {
      logAPI('supabase://transaction_splits', { source: 'useSplits', action: 'deleteSplits' });
      const { error } = await supabase
        .from('transaction_splits')
        .delete()
        .eq('parent_transaction_id', transactionId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: splitsQueryKey(transactionId) });
      await queryClient.invalidateQueries({ queryKey: ['splits_batch'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch {
      // non-fatal on delete (cascade handles DB side)
    }
  }, [queryClient]);

  return { loadSplitsForTransaction, saveSplits, deleteSplitsForTransaction };
}
