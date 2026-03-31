import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { AppTransaction } from '../types/dashboard';

export const transactionsQueryKey = (sortedAccountKey: string) =>
  ['transactions', sortedAccountKey] as const;

export function sortedKey(accountIds: string[]): string {
  return [...accountIds].sort().join(',');
}

async function fetchTransactions(accountIds: string[]): Promise<AppTransaction[]> {
  if (accountIds.length === 0) return [];

  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .select('id,account_id,category_id,amount,note,type,date,created_at')
    .in('account_id', accountIds)
    .order('date', { ascending: false })
    .limit(1000);

  if (txError) throw txError;

  const txList = (txData ?? []) as AppTransaction[];
  if (txList.length === 0) return [];

  const txIds = txList.map((t) => t.id);
  const { data: tagRows, error: tagError } = await supabase
    .from('transaction_tags')
    .select('transaction_id,tag_id')
    .in('transaction_id', txIds);

  if (tagError) throw tagError;

  const tagMap = (tagRows ?? []).reduce<Record<string, string[]>>((acc, row) => {
    if (!acc[row.transaction_id]) acc[row.transaction_id] = [];
    acc[row.transaction_id].push(row.tag_id);
    return acc;
  }, {});

  return txList.map((tx) => ({ ...tx, tag_ids: tagMap[tx.id] ?? [] }));
}

/**
 * Fetches all transactions for the given accountIds, limit 1000, ordered by date desc.
 * Client-side slicing (visibleTransactionsCount) provides the "infinite scroll" UX.
 * queryKey includes a stable sorted string so that reordering accounts doesn't
 * invalidate the cache unnecessarily.
 */
export function useTransactionsQuery(accountIds: string[]) {
  const key = sortedKey(accountIds);
  return useQuery({
    queryKey: transactionsQueryKey(key),
    queryFn: () => fetchTransactions(accountIds),
    enabled: accountIds.length > 0,
  });
}
