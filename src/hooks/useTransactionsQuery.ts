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

  const { data, error } = await supabase
    .from('transactions')
    .select('id,account_id,category_id,amount,note,type,date,created_at,transaction_tags(tag_id)')
    .in('account_id', accountIds)
    .order('date', { ascending: false })
    .limit(1000);

  if (error) throw error;

  return (data ?? []).map((tx) => ({
    id: tx.id,
    account_id: tx.account_id,
    category_id: tx.category_id,
    amount: tx.amount,
    note: tx.note,
    type: tx.type,
    date: tx.date,
    created_at: tx.created_at,
    tag_ids: (tx.transaction_tags ?? []).map((t: { tag_id: string }) => t.tag_id),
  }));
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
