import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { AppTag } from '../types/dashboard';

export const tagsQueryKey = (userId: string) =>
  ['tags', userId] as const;

async function fetchTags(): Promise<AppTag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('id,user_id,account_id,name,color,icon')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as AppTag[];
}

export function useTagsQuery(userId: string) {
  return useQuery({
    queryKey: tagsQueryKey(userId),
    queryFn: fetchTags,
    enabled: !!userId,
  });
}
