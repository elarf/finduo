import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import {
  AppAccount,
  AppCategory,
  AppTag,
  AppTransaction,
  AccountSetting,
  isMissingTableError,
  isMissingColumnError,
  todayIso,
} from '../types/dashboard';
import type { User } from '@supabase/supabase-js';

// Capture native timer functions before they get shadowed
const _setInterval = setInterval;
const _clearInterval = clearInterval;

export function useDashboardData(user: User | null) {
  const [accounts, setAccounts] = useState<AppAccount[]>([]);
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [tags, setTags] = useState<AppTag[]>([]);
  const [transactions, setTransactions] = useState<AppTransaction[]>([]);
  const [accountSettings, setAccountSettings] = useState<Record<string, AccountSetting>>({});
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<Set<string>>(new Set());

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [primaryAccountId, setPrimaryAccountId] = useState<string | null>(null);
  const [excludedAccountIds, setExcludedAccountIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  /** 0→1 multiplier applied to displayed numbers during the count-up animation after a silent reload. */
  const [animMultiplier, setAnimMultiplier] = useState(1);
  const [saving, setSaving] = useState(false);
  const [missingSchemaColumns, setMissingSchemaColumns] = useState<string[]>([]);

  const [entryAccountId, setEntryAccountId] = useState<string | null>(null);

  const pendingSelectedAccountIdRef = useRef<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const schemaAlertSignatureRef = useRef('');
  const animIntervalRef = useRef<ReturnType<typeof _setInterval> | null>(null);

  const checkRequiredSchemaColumns = useCallback(async () => {
    const missing: string[] = [];

    const carryCheck = await supabase
      .from('account_settings')
      .select('carry_over_balance')
      .limit(1);
    if (carryCheck.error && isMissingColumnError(carryCheck.error)) {
      missing.push('account_settings.carry_over_balance');
    }

    const inviteNameCheck = await supabase
      .from('account_invites')
      .select('name')
      .limit(1);
    if (inviteNameCheck.error && isMissingColumnError(inviteNameCheck.error)) {
      missing.push('account_invites.name');
    }

    const accountIconCheck = await supabase
      .from('accounts')
      .select('icon')
      .limit(1);
    if (accountIconCheck.error && isMissingColumnError(accountIconCheck.error)) {
      missing.push('accounts.icon');
    }

    const tagIconCheck = await supabase
      .from('tags')
      .select('icon')
      .limit(1);
    if (tagIconCheck.error && isMissingColumnError(tagIconCheck.error)) {
      missing.push('tags.icon');
    }

    setMissingSchemaColumns(missing);
  }, []);

  /** Persist account order + primary selection to database (+ local cache). */
  const saveAccountPrefs = useCallback((orderedAccounts: AppAccount[], primaryId: string | null, excluded?: string[]) => {
    if (!user) return;
    const order = orderedAccounts.map((a) => a.id);
    const payload: any = {
      user_id: user.id,
      account_order: order,
      primary_account_id: primaryId,
      updated_at: new Date().toISOString(),
    };
    if (excluded !== undefined) payload.excluded_account_ids = excluded;
    // Save to Supabase
    void supabase.from('user_preferences').upsert(payload);
    // Local cache for fast initial load
    void AsyncStorage.setItem(
      `finduo_account_prefs_${user.id}`,
      JSON.stringify({ order, primaryId }),
    );
  }, [user]);

  const toggleAccountExclusion = useCallback((accountId: string) => {
    setExcludedAccountIds((prev) => {
      const next = prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId];
      saveAccountPrefs(accounts, primaryAccountId, next);
      return next;
    });
  }, [accounts, primaryAccountId, saveAccountPrefs]);

  /** Move an account up or down in the list and persist the new order. */
  const moveAccount = useCallback((idx: number, direction: 'up' | 'down') => {
    setAccounts((prev) => {
      const next = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      saveAccountPrefs(next, primaryAccountId);
      return next;
    });
  }, [primaryAccountId, saveAccountPrefs]);

  /** Set an account as the primary (default on load) and select it now. */
  const setPrimary = useCallback((id: string) => {
    setPrimaryAccountId(id);
    setSelectedAccountId(id);
    setAccounts((prev) => {
      saveAccountPrefs(prev, id);
      return prev;
    });
  }, [saveAccountPrefs]);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) return;

    if (!opts?.silent) setLoading(true);
    try {
      await checkRequiredSchemaColumns();

      const { data: owned, error: ownedError } = await supabase
        .from('accounts')
        .select('id,name,currency,icon,created_at,created_by,tag_ids')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });
      if (ownedError) throw ownedError;

      const { data: memberships, error: membershipsError } = await supabase
        .from('account_members')
        .select('account_id')
        .eq('user_id', user.id);
      if (membershipsError) throw membershipsError;

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

      // Apply stored order + primary preference (Supabase first, AsyncStorage fallback)
      let orderedAccounts = allAccounts;
      let storedPrimaryId: string | null = null;
      try {
        let order: string[] | undefined;
        let primaryId: string | undefined;

        // Try Supabase first
        const { data: dbPrefs } = await supabase
          .from('user_preferences')
          .select('account_order, primary_account_id, excluded_account_ids')
          .eq('user_id', user.id)
          .maybeSingle();
        if (dbPrefs) {
          order = dbPrefs.account_order as string[] | undefined;
          primaryId = dbPrefs.primary_account_id as string | undefined;
          if (Array.isArray(dbPrefs.excluded_account_ids)) {
            setExcludedAccountIds(dbPrefs.excluded_account_ids as string[]);
          }
        }

        // Fall back to AsyncStorage if nothing in DB
        if (!order?.length && !primaryId) {
          const raw = await AsyncStorage.getItem(`finduo_account_prefs_${user.id}`);
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
          storedPrimaryId = primaryId;
        }
      } catch {
        // ignore storage errors — fall back to default ordering
      }

      setAccounts(orderedAccounts);

      const resolvedPrimary = storedPrimaryId ?? orderedAccounts[0]?.id ?? null;
      setPrimaryAccountId(resolvedPrimary);

      const requestedSelected = pendingSelectedAccountIdRef.current;
      const nextSelected =
        requestedSelected && orderedAccounts.some((a) => a.id === requestedSelected)
          ? requestedSelected
          : resolvedPrimary;

      pendingSelectedAccountIdRef.current = null;
      setSelectedAccountId(nextSelected);
      setEntryAccountId((prev) => {
        if (prev && orderedAccounts.some((a) => a.id === prev)) {
          return prev;
        }
        return nextSelected ?? null;
      });

      const accountIds = allAccounts.map((a) => a.id);
      if (accountIds.length === 0) {
        setCategories([]);
        setTags([]);
        setTransactions([]);
        setAccountSettings({});
        return;
      }

      const accountIdList = accountIds.join(',');

      const [
        { data: categoryData, error: categoryError },
        { data: tagData, error: tagError },
        { data: txData, error: txError },
        { data: hiddenCatData, error: hiddenCatError },
      ] = await Promise.all([
        supabase
          .from('categories')
          .select('id,user_id,name,type,color,icon,tag_ids')
          .order('name', { ascending: true }),
        supabase
          .from('tags')
          .select('id,account_id,name,color,icon')
          .or(`account_id.in.(${accountIdList}),account_id.is.null`)
          .order('name', { ascending: true }),
        supabase
          .from('transactions')
          .select('id,account_id,category_id,amount,note,type,date,created_at')
          .in('account_id', accountIds)
          .order('date', { ascending: false })
          .limit(1000),
        supabase
          .from('user_hidden_categories')
          .select('category_id'),
      ]);

      if (categoryError) throw categoryError;
      if (tagError) throw tagError;
      if (txError) throw txError;
      // hiddenCatError is non-fatal — table may not exist yet during migration rollout
      if (!hiddenCatError) {
        setHiddenCategoryIds(new Set((hiddenCatData ?? []).map((r: any) => r.category_id as string)));
      }

      let settingsRows: any[] = [];
      const withCarryResponse = await supabase
        .from('account_settings')
        .select('account_id,included_in_balance,carry_over_balance,initial_balance,initial_balance_date')
        .in('account_id', accountIds);

      if (withCarryResponse.error && isMissingColumnError(withCarryResponse.error)) {
        const fallbackResponse = await supabase
          .from('account_settings')
          .select('account_id,included_in_balance,initial_balance,initial_balance_date')
          .in('account_id', accountIds);

        if (fallbackResponse.error && !isMissingTableError(fallbackResponse.error)) {
          throw fallbackResponse.error;
        }
        settingsRows = fallbackResponse.data ?? [];
      } else if (withCarryResponse.error && !isMissingTableError(withCarryResponse.error)) {
        throw withCarryResponse.error;
      } else {
        settingsRows = withCarryResponse.data ?? [];
      }

      const settingsMap: Record<string, AccountSetting> = {};
      for (const s of settingsRows) {
        settingsMap[s.account_id] = {
          account_id: s.account_id,
          included_in_balance: s.included_in_balance ?? true,
          carry_over_balance: s.carry_over_balance ?? true,
          initial_balance: Number(s.initial_balance ?? 0),
          initial_balance_date: s.initial_balance_date,
        };
      }

      for (const account of allAccounts) {
        if (!settingsMap[account.id]) {
          settingsMap[account.id] = {
            account_id: account.id,
            included_in_balance: true,
            carry_over_balance: true,
            initial_balance: 0,
            initial_balance_date: account.created_at?.slice(0, 10) ?? todayIso(),
          };
        }
      }

      const txList = (txData ?? []) as AppTransaction[];
      const txIds = txList.map((t) => t.id);
      let txTagRows: any[] = [];
      if (txIds.length > 0) {
        const { data, error } = await supabase
          .from('transaction_tags')
          .select('transaction_id,tag_id')
          .in('transaction_id', txIds);
        if (error) throw error;
        txTagRows = data ?? [];
      }

      const tagMap = txTagRows.reduce((acc: Record<string, string[]>, row: any) => {
        if (!acc[row.transaction_id]) acc[row.transaction_id] = [];
        acc[row.transaction_id].push(row.tag_id);
        return acc;
      }, {});

      setCategories((categoryData ?? []) as AppCategory[]);
      setTags((tagData ?? []) as AppTag[]);
      setAccountSettings(settingsMap);
      setTransactions(
        txList.map((tx) => ({
          ...tx,
          tag_ids: tagMap[tx.id] ?? [],
        })),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard data.';
      Alert.alert('Dashboard error', msg);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [checkRequiredSchemaColumns, user]);

  /** Counts displayed numbers up from 0 → actual value over ~200 ms (ease-out cubic). */
  const animateIn = useCallback(() => {
    if (animIntervalRef.current) _clearInterval(animIntervalRef.current);
    setReloading(false);
    setAnimMultiplier(0);
    let step = 0;
    const STEPS = 20;
    const INTERVAL_MS = 200 / STEPS;
    animIntervalRef.current = _setInterval(() => {
      step += 1;
      const t = step / STEPS;
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      if (step >= STEPS) {
        setAnimMultiplier(1);
        _clearInterval(animIntervalRef.current!);
        animIntervalRef.current = null;
      } else {
        setAnimMultiplier(eased);
      }
    }, INTERVAL_MS);
  }, []);

  /** Silent reload: fetches fresh data then animates numbers from 0. */
  const reloadDashboard = useCallback(async () => {
    if (reloading) return;
    setReloading(true);
    await loadData({ silent: true });
    animateIn();
  }, [animateIn, loadData, reloading]);

  return {
    // Core data
    accounts,
    setAccounts,
    categories,
    setCategories,
    tags,
    setTags,
    transactions,
    setTransactions,
    accountSettings,
    setAccountSettings,
    hiddenCategoryIds,
    setHiddenCategoryIds,

    // Selection
    selectedAccountId,
    setSelectedAccountId,
    primaryAccountId,
    setPrimaryAccountId,
    entryAccountId,
    setEntryAccountId,
    excludedAccountIds,
    setExcludedAccountIds,

    // Loading state
    loading,
    setLoading,
    reloading,
    setReloading,
    animMultiplier,
    saving,
    setSaving,
    missingSchemaColumns,

    // Refs
    pendingSelectedAccountIdRef,
    hasLoadedOnceRef,
    schemaAlertSignatureRef,

    // Actions
    loadData,
    reloadDashboard,
    saveAccountPrefs,
    moveAccount,
    setPrimary,
    toggleAccountExclusion,
  };
}
