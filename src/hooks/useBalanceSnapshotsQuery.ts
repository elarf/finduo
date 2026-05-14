import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type BalanceSnapshot = {
  account_id: string;
  snapshot_date: string; // YYYY-MM-DD, last day of the month
  balance: number;
};

export function balanceSnapshotsQueryKey(sortedKey: string) {
  return ['balance_snapshots', sortedKey] as const;
}

async function fetchBalanceSnapshots(accountIds: string[]): Promise<BalanceSnapshot[]> {
  if (accountIds.length === 0) return [];
  const { data, error } = await supabase
    .from('balance_snapshots')
    .select('account_id, snapshot_date, balance')
    .in('account_id', accountIds)
    .order('snapshot_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function useBalanceSnapshotsQuery(accountIds: string[]) {
  const sortedKey = [...accountIds].sort().join(',');
  return useQuery({
    queryKey: balanceSnapshotsQueryKey(sortedKey),
    queryFn: () => fetchBalanceSnapshots(accountIds),
    enabled: accountIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
