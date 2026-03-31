import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { AppTag } from '../types/dashboard';
import { sortedKey } from './useTransactionsQuery';

export const tagsQueryKey = (sortedAccountKey: string) =>
  ['tags', sortedAccountKey] as const;

async function fetchTags(accountIds: string[]): Promise<AppTag[]> {
  if (accountIds.length === 0) return [];

  const idList = accountIds.join(',');
  const { data, error } = await supabase
    .from('tags')
    .select('id,account_id,name,color,icon')
    .or(`account_id.in.(${idList}),account_id.is.null`)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as AppTag[];
}

export function useTagsQuery(accountIds: string[]) {
  const key = sortedKey(accountIds);
  return useQuery({
    queryKey: tagsQueryKey(key),
    queryFn: () => fetchTags(accountIds),
    enabled: accountIds.length > 0,
  });
}
