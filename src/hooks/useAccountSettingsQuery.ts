import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  isMissingColumnError,
  isMissingTableError,
  todayIso,
} from '../types/dashboard';
import type { AccountSetting, AppAccount } from '../types/dashboard';
import { sortedKey } from './useTransactionsQuery';

export const accountSettingsQueryKey = (sortedAccountKey: string) =>
  ['account_settings', sortedAccountKey] as const;

async function fetchAccountSettings(
  accounts: AppAccount[],
): Promise<Record<string, AccountSetting>> {
  if (accounts.length === 0) return {};

  const accountIds = accounts.map((a) => a.id);
  let rows: any[] = [];

  const res = await supabase
    .from('account_settings')
    .select('account_id,included_in_balance,carry_over_balance,initial_balance,initial_balance_date')
    .in('account_id', accountIds);

  if (res.error && isMissingColumnError(res.error)) {
    const fb = await supabase
      .from('account_settings')
      .select('account_id,included_in_balance,initial_balance,initial_balance_date')
      .in('account_id', accountIds);
    if (fb.error && !isMissingTableError(fb.error)) throw fb.error;
    rows = fb.data ?? [];
  } else if (res.error && !isMissingTableError(res.error)) {
    throw res.error;
  } else {
    rows = res.data ?? [];
  }

  const map: Record<string, AccountSetting> = {};
  for (const s of rows) {
    map[s.account_id] = {
      account_id: s.account_id,
      included_in_balance: s.included_in_balance ?? true,
      carry_over_balance: s.carry_over_balance ?? true,
      initial_balance: Number(s.initial_balance ?? 0),
      initial_balance_date: s.initial_balance_date,
    };
  }

  // Fill defaults for accounts without settings rows
  for (const a of accounts) {
    if (!map[a.id]) {
      map[a.id] = {
        account_id: a.id,
        included_in_balance: true,
        carry_over_balance: true,
        initial_balance: 0,
        initial_balance_date: a.created_at?.slice(0, 10) ?? todayIso(),
      };
    }
  }

  return map;
}

export function useAccountSettingsQuery(accounts: AppAccount[]) {
  const key = sortedKey(accounts.map((a) => a.id));
  return useQuery({
    queryKey: accountSettingsQueryKey(key),
    queryFn: () => fetchAccountSettings(accounts),
    enabled: accounts.length > 0,
  });
}
