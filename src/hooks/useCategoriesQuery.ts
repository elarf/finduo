import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { AppCategory } from '../types/dashboard';

export type CategoriesQueryData = {
  categories: AppCategory[];
  hiddenCategoryIds: Set<string>;
};

export const categoriesQueryKey = (userId: string) => ['categories', userId] as const;

async function fetchCategories(userId: string): Promise<CategoriesQueryData> {
  const [{ data: catData, error: catError }, { data: hiddenData, error: hiddenError }] =
    await Promise.all([
      supabase
        .from('categories')
        .select('id,user_id,name,type,color,icon,tag_ids,temp_for,is_default')
        .order('name', { ascending: true }),
      supabase
        .from('user_hidden_categories')
        .select('category_id'),
    ]);

  if (catError) throw catError;
  // hiddenError is non-fatal — table may not exist yet during migration rollout

  return {
    categories: (catData ?? []) as AppCategory[],
    hiddenCategoryIds: new Set(
      (!hiddenError ? hiddenData ?? [] : []).map((r: any) => r.category_id as string),
    ),
  };
}

export function useCategoriesQuery(userId: string | undefined) {
  return useQuery({
    queryKey: categoriesQueryKey(userId ?? ''),
    queryFn: () => fetchCategories(userId!),
    enabled: !!userId,
  });
}
