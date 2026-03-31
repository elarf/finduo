import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { AppAccount } from '../types/dashboard';

export type AccountsQueryData = {
  accounts: AppAccount[];
  primaryAccountId: string | null;
  excludedAccountIds: string[];
};

export const accountsQueryKey = (userId: string) => ['accounts', userId] as const;

async function fetchAccounts(userId: string): Promise<AccountsQueryData> {
  const [{ data: owned, error: ownedError }, { data: memberships, error: membErr }] =
    await Promise.all([
      supabase
        .from('accounts')
        .select('id,name,currency,icon,created_at,created_by,tag_ids')
        .eq('created_by', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('account_members')
        .select('account_id')
        .eq('user_id', userId),
    ]);

  if (ownedError) throw ownedError;
  if (membErr) throw membErr;

  const memberIds = (memberships ?? []).map((m: any) => m.account_id as string);
  let shared: AppAccount[] = [];
  if (memberIds.length > 0) {
    const { data, error } = await supabase
      .from('accounts')
      .select('id,name,currency,icon,created_at,created_by,tag_ids')
      .in('id', memberIds);
    if (error) throw error;
    shared = (data ?? []) as AppAccount[];
  }

  const allAccounts = [...(owned ?? []), ...shared].filter(
    (acc, idx, arr) => arr.findIndex((a) => a.id === acc.id) === idx,
  ) as AppAccount[];

  let orderedAccounts = allAccounts;
  let primaryAccountId: string | null = null;
  let excludedAccountIds: string[] = [];

  try {
    let order: string[] | undefined;
    let primaryId: string | undefined;

    const { data: dbPrefs } = await supabase
      .from('user_preferences')
      .select('account_order,primary_account_id,excluded_account_ids')
      .eq('user_id', userId)
      .maybeSingle();

    if (dbPrefs) {
      order = dbPrefs.account_order as string[] | undefined;
      primaryId = dbPrefs.primary_account_id as string | undefined;
      if (Array.isArray(dbPrefs.excluded_account_ids)) {
        excludedAccountIds = dbPrefs.excluded_account_ids as string[];
      }
    }

    if (!order?.length && !primaryId) {
      const raw = await AsyncStorage.getItem(`finduo_account_prefs_${userId}`);
      if (raw) {
        const local = JSON.parse(raw) as { order?: string[]; primaryId?: string };
        order = local.order;
        primaryId = local.primaryId;
      }
    }

    if (order?.length) {
      const validIds = order.filter((id) => allAccounts.some((a) => a.id === id));
      const unordered = allAccounts.filter((a) => !validIds.includes(a.id));
      orderedAccounts = [
        ...validIds.map((id) => allAccounts.find((a) => a.id === id)!),
        ...unordered,
      ];
    }

    if (primaryId && allAccounts.some((a) => a.id === primaryId)) {
      primaryAccountId = primaryId;
    }
  } catch {
    // ignore storage errors — fall back to default ordering
  }

  return {
    accounts: orderedAccounts,
    primaryAccountId: primaryAccountId ?? orderedAccounts[0]?.id ?? null,
    excludedAccountIds,
  };
}

export function useAccountsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: accountsQueryKey(userId ?? ''),
    queryFn: () => fetchAccounts(userId!),
    enabled: !!userId,
  });
}
