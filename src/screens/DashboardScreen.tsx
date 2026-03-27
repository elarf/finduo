import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type TransactionType = 'income' | 'expense';
type IntervalKey = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom';

type AppAccount = {
  id: string;
  name: string;
  currency: string;
  created_at?: string;
  created_by?: string;
};

type AppCategory = {
  id: string;
  account_id?: string | null;
  name: string;
  type: TransactionType;
};

type AppTag = {
  id: string;
  account_id: string;
  name: string;
};

type AppTransaction = {
  id: string;
  account_id: string;
  category_id?: string | null;
  amount: number;
  note?: string | null;
  type: TransactionType;
  date: string;
  created_at?: string;
  tag_ids: string[];
};

type AccountInvite = {
  id: string;
  account_id: string;
  token: string;
  name?: string | null;
  invited_by: string;
  expires_at: string;
  used_at?: string | null;
};

type AccountSetting = {
  account_id: string;
  included_in_balance: boolean;
  carry_over_balance: boolean;
  initial_balance: number;
  initial_balance_date?: string | null;
};

type ManagedInvite = {
  id: string;
  account_id: string;
  token: string;
  name: string;
  expires_at: string;
  used_at?: string | null;
};

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'HUF'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseAmount(value: string): number {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  return Number(normalized);
}

function formatShortDate(date?: string): string {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as { code?: unknown }).code;
  const maybeMessage = (error as { message?: unknown }).message;
  const code = typeof maybeCode === 'string' ? maybeCode : '';
  const message = typeof maybeMessage === 'string' ? maybeMessage.toLowerCase() : '';
  return code === 'PGRST205' || code === '42P01' || message.includes('could not find the table');
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as { code?: unknown }).code;
  const maybeMessage = (error as { message?: unknown }).message;
  const code = typeof maybeCode === 'string' ? maybeCode : '';
  const message = typeof maybeMessage === 'string' ? maybeMessage.toLowerCase() : '';
  return code === 'PGRST204' || code === '42703' || (message.includes('column') && message.includes('does not exist'));
}

export default function DashboardScreen() {
  const { user, signOut } = useAuth();
  const { width } = useWindowDimensions();

  const [accounts, setAccounts] = useState<AppAccount[]>([]);
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [tags, setTags] = useState<AppTag[]>([]);
  const [transactions, setTransactions] = useState<AppTransaction[]>([]);
  const [accountSettings, setAccountSettings] = useState<Record<string, AccountSetting>>({});

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [primaryAccountId, setPrimaryAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [interval, setInterval] = useState<IntervalKey>('month');
  const [customStart, setCustomStart] = useState(todayIso());
  const [customEnd, setCustomEnd] = useState(todayIso());

  const [menuOpen, setMenuOpen] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showInvitationsModal, setShowInvitationsModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [viewModeOverride, setViewModeOverride] = useState<'desktop' | 'mobile' | null>(null);
  const [showAccountOverviewPicker, setShowAccountOverviewPicker] = useState(false);
  const [visibleTransactionsCount, setVisibleTransactionsCount] = useState(12);
  const [menuAccountsExpanded, setMenuAccountsExpanded] = useState(false);
  const [menuCategoriesExpanded, setMenuCategoriesExpanded] = useState(false);
  const [menuTagsExpanded, setMenuTagsExpanded] = useState(false);
  const [missingSchemaColumns, setMissingSchemaColumns] = useState<string[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  const [entryType, setEntryType] = useState<TransactionType>('expense');
  const [entryAccountId, setEntryAccountId] = useState<string | null>(null);
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayIso());
  const [entryCategoryId, setEntryCategoryId] = useState<string | null>(null);
  const [entryNote, setEntryNote] = useState('');
  const [entryTagIds, setEntryTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [noteFieldFocused, setNoteFieldFocused] = useState(false);

  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<TransactionType>('expense');
  const [tagName, setTagName] = useState('');

  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountCurrency, setNewAccountCurrency] = useState('USD');

  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState('');
  const [invitationAccountId, setInvitationAccountId] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteExpiresDays, setInviteExpiresDays] = useState('7');
  const [editingInviteId, setEditingInviteId] = useState<string | null>(null);
  const [managedInvites, setManagedInvites] = useState<ManagedInvite[]>([]);

  const [settingsIncluded, setSettingsIncluded] = useState(true);
  const [settingsCarryOver, setSettingsCarryOver] = useState(true);
  const [settingsInitialBalance, setSettingsInitialBalance] = useState('0');
  const [settingsInitialDate, setSettingsInitialDate] = useState(todayIso());

  const [transferFromId, setTransferFromId] = useState<string | null>(null);
  const [transferToId, setTransferToId] = useState<string | null>(null);
  const [transferSourceAmount, setTransferSourceAmount] = useState('');
  const [transferRate, setTransferRate] = useState('');
  const [transferTargetAmount, setTransferTargetAmount] = useState('');
  const [transferDate, setTransferDate] = useState(todayIso());
  const [transferNote, setTransferNote] = useState('');

  const [showIntervalPicker, setShowIntervalPicker] = useState(false);
  const [showEntryAccountPicker, setShowEntryAccountPicker] = useState(false);
  const [overviewCollapsed, setOverviewCollapsed] = useState(false);
  const [spendingCollapsed, setSpendingCollapsed] = useState(true);
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false);

  const amountInputRef = useRef<TextInput | null>(null);
  const dateInputRef = useRef<TextInput | null>(null);
  const noteInputRef = useRef<TextInput | null>(null);
  const pendingSelectedAccountIdRef = useRef<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const schemaAlertSignatureRef = useRef('');

  const isDesktopBrowser = Platform.OS === 'web' && width >= 1024;
  const desktopView = isDesktopBrowser && viewModeOverride !== 'mobile';
  const framedMobileView = isDesktopBrowser && viewModeOverride === 'mobile';

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const entryAccount = useMemo(
    () => accounts.find((a) => a.id === entryAccountId) ?? null,
    [accounts, entryAccountId],
  );

  const editingAccount = useMemo(
    () => accounts.find((a) => a.id === editingAccountId) ?? null,
    [accounts, editingAccountId],
  );

  const selectedCurrency = selectedAccount?.currency ?? 'USD';
  const selectedTags = useMemo(() => tags, [tags]);

  const formatCurrency = useCallback((value: number, currencyOverride?: string) => {
    const code = currencyOverride ?? selectedCurrency;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: code === 'HUF' ? 0 : 2,
    }).format(value);
  }, [selectedCurrency]);

  const selectedCategories = useMemo(
    () => categories.filter((c) => c.account_id === selectedAccountId || c.account_id === null),
    [categories, selectedAccountId],
  );

  const entryCategories = useMemo(
    () => categories
      .filter((c) => c.account_id === entryAccountId || c.account_id === null)
      .filter((c) => c.type === entryType),
    [categories, entryAccountId, entryType],
  );

  const entryTags = useMemo(() => tags, [tags]);

  const selectedTxs = useMemo(
    () => transactions.filter((t) => t.account_id === selectedAccountId),
    [transactions, selectedAccountId],
  );

  const recentCategoryAmounts = useMemo(() => {
    const unique = new Set<number>();
    const source = transactions
      .filter((t) => t.account_id === entryAccountId)
      .filter((t) => t.type === entryType)
      .filter((t) => !entryCategoryId || t.category_id === entryCategoryId);

    for (const tx of source) {
      const n = Math.abs(Number(tx.amount) || 0);
      if (n > 0) unique.add(n);
      if (unique.size >= 6) break;
    }
    return Array.from(unique);
  }, [entryAccountId, entryCategoryId, entryType, transactions]);

  const noteSuggestions = useMemo(() => {
    if (!entryCategoryId && !noteFieldFocused) return [];
    const prefix = entryNote.trim().toLowerCase();
    const seen = new Set<string>();
    const results: string[] = [];
    for (const tx of transactions) {
      if (tx.account_id !== entryAccountId) continue;
      if (tx.category_id !== entryCategoryId) continue;
      if (tx.type !== entryType) continue;
      const note = tx.note?.trim();
      if (!note) continue;
      if (seen.has(note)) continue;
      if (prefix.length > 0 && !note.toLowerCase().startsWith(prefix)) continue;
      seen.add(note);
      results.push(note);
      if (results.length >= 5) break;
    }
    return results;
  }, [transactions, entryAccountId, entryCategoryId, entryType, entryNote, noteFieldFocused]);

  const intervalBounds = useMemo(() => {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    const dayMs = 24 * 60 * 60 * 1000;

    if (interval === 'all') return { start: '', end: '' };
    if (interval === 'custom') return { start: customStart, end: customEnd };
    if (interval === 'day') return { start: end, end };
    if (interval === 'week') {
      return { start: new Date(now.getTime() - 6 * dayMs).toISOString().slice(0, 10), end };
    }
    if (interval === 'month') {
      const d = new Date(now);
      d.setDate(1);
      return { start: d.toISOString().slice(0, 10), end };
    }

    const y = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    return { start: y, end };
  }, [customEnd, customStart, interval]);

  const inInterval = useCallback((date: string) => {
    if (interval === 'all') return true;
    if (!intervalBounds.start || !intervalBounds.end) return true;
    return date >= intervalBounds.start && date <= intervalBounds.end;
  }, [interval, intervalBounds.end, intervalBounds.start]);

  const filteredSelectedTxs = useMemo(
    () => selectedTxs.filter((t) => inInterval(t.date)),
    [inInterval, selectedTxs],
  );

  const visibleSelectedTxs = useMemo(
    () => filteredSelectedTxs.slice(0, visibleTransactionsCount),
    [filteredSelectedTxs, visibleTransactionsCount],
  );

  const hasMoreTransactions = visibleTransactionsCount < filteredSelectedTxs.length;

  const buildAccountSummary = useCallback((accountId: string) => {
    const setting = accountSettings[accountId];
    const initialBalance = Number(setting?.initial_balance ?? 0);
    const carryOver = setting?.carry_over_balance ?? true;

    let openingBalance = 0;
    if (interval === 'all') {
      openingBalance = initialBalance;
    } else if (carryOver && intervalBounds.start) {
      openingBalance = initialBalance;
      for (const tx of transactions) {
        if (tx.account_id !== accountId || tx.date >= intervalBounds.start) continue;
        const n = Number(tx.amount) || 0;
        openingBalance += tx.type === 'income' ? n : -n;
      }
    }

    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (tx.account_id !== accountId || !inInterval(tx.date)) continue;
      const n = Number(tx.amount) || 0;
      if (tx.type === 'income') income += n;
      else expense += n;
    }

    return {
      income,
      expense,
      openingBalance,
      net: openingBalance + income - expense,
    };
  }, [accountSettings, inInterval, interval, intervalBounds.start, transactions]);

  const selectedSummary = useMemo(() => {
    if (!selectedAccountId) {
      return { income: 0, expense: 0, net: 0, openingBalance: 0 };
    }
    return buildAccountSummary(selectedAccountId);
  }, [buildAccountSummary, selectedAccountId]);

  const includedAccountIds = useMemo(
    () => accounts
      .filter((a) => accountSettings[a.id]?.included_in_balance ?? true)
      .map((a) => a.id),
    [accountSettings, accounts],
  );

  const includedAccountSummaries = useMemo(() => {
    return accounts
      .filter((account) => includedAccountIds.includes(account.id))
      .map((account) => {
        const summary = buildAccountSummary(account.id);

        return {
          account,
          income: summary.income,
          expense: summary.expense,
          openingBalance: summary.openingBalance,
          balance: summary.net,
        };
      });
  }, [accounts, buildAccountSummary, includedAccountIds]);

  const totalIncludedSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let openingBalance = 0;

    for (const row of includedAccountSummaries) {
      income += row.income;
      expense += row.expense;
      openingBalance += row.openingBalance;
    }

    return {
      income,
      expense,
      openingBalance,
      net: openingBalance + income - expense,
    };
  }, [includedAccountSummaries]);

  const totalIncludedBalance = totalIncludedSummary.net;

  const overviewSummary = showAccountOverviewPicker ? totalIncludedSummary : selectedSummary;

  const categorySpendData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of filteredSelectedTxs) {
      if (tx.type !== 'expense') continue;
      const key = tx.category_id ?? 'uncategorized';
      map[key] = (map[key] ?? 0) + (Number(tx.amount) || 0);
    }

    const rows = Object.entries(map)
      .map(([id, total]) => {
        const name = selectedCategories.find((c) => c.id === id)?.name ??
          (id === 'uncategorized' ? 'Uncategorized' : 'Other');
        return { id, name, total };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 7);

    const max = rows[0]?.total ?? 0;
    return rows.map((r) => ({
      ...r,
      widthPercent: max > 0 ? Math.max(8, Math.round((r.total / max) * 100)) : 0,
    }));
  }, [filteredSelectedTxs, selectedCategories]);

  const categoryFilteredTxs = useMemo(() => {
    if (!selectedCategoryFilter) return null;
    return filteredSelectedTxs.filter((tx) =>
      selectedCategoryFilter === 'uncategorized' ? !tx.category_id : tx.category_id === selectedCategoryFilter,
    );
  }, [filteredSelectedTxs, selectedCategoryFilter]);

  const categoryFilteredTxsVisible = useMemo(
    () => categoryFilteredTxs?.slice(0, visibleTransactionsCount) ?? null,
    [categoryFilteredTxs, visibleTransactionsCount],
  );

  const sortedSelectedCategories = useMemo(() => {
    const countById: Record<string, number> = {};
    for (const tx of selectedTxs) {
      if (tx.category_id) {
        countById[tx.category_id] = (countById[tx.category_id] ?? 0) + 1;
      }
    }
    const byUsage = (a: AppCategory, b: AppCategory) =>
      (countById[b.id] ?? 0) - (countById[a.id] ?? 0);
    return [
      ...selectedCategories.filter((c) => c.type === 'expense').sort(byUsage),
      ...selectedCategories.filter((c) => c.type === 'income').sort(byUsage),
    ];
  }, [selectedCategories, selectedTxs]);

  const selectedFilterCategory = useMemo(
    () => (selectedCategoryFilter ? selectedCategories.find((c) => c.id === selectedCategoryFilter) ?? null : null),
    [selectedCategories, selectedCategoryFilter],
  );
  const filterIsExpense = !!selectedFilterCategory && selectedFilterCategory.type === 'expense';

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

    setMissingSchemaColumns(missing);
  }, []);

  /** Persist account order + primary selection to device storage. */
  const saveAccountPrefs = useCallback((orderedAccounts: AppAccount[], primaryId: string | null) => {
    if (!user) return;
    void AsyncStorage.setItem(
      `finduo_account_prefs_${user.id}`,
      JSON.stringify({ order: orderedAccounts.map((a) => a.id), primaryId }),
    );
  }, [user]);

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

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      await checkRequiredSchemaColumns();

      const { data: owned, error: ownedError } = await supabase
        .from('accounts')
        .select('id,name,currency,created_at,created_by')
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
          .select('id,name,currency,created_at,created_by')
          .in('id', memberIds);
        if (error) throw error;
        shared = (data ?? []) as AppAccount[];
      }

      const allAccounts = [...(owned ?? []), ...shared].filter(
        (acc, idx, arr) => arr.findIndex((a) => a.id === acc.id) === idx,
      ) as AppAccount[];

      // Apply stored order + primary preference
      let orderedAccounts = allAccounts;
      let storedPrimaryId: string | null = null;
      try {
        const raw = await AsyncStorage.getItem(`finduo_account_prefs_${user.id}`);
        if (raw) {
          const prefs = JSON.parse(raw) as { order?: string[]; primaryId?: string };
          if (prefs.order?.length) {
            const validIds = prefs.order.filter((id) => allAccounts.some((a) => a.id === id));
            const unordered = allAccounts.filter((a) => !validIds.includes(a.id));
            orderedAccounts = [
              ...validIds.map((id) => allAccounts.find((a) => a.id === id)!),
              ...unordered,
            ];
          }
          if (prefs.primaryId && allAccounts.some((a) => a.id === prefs.primaryId)) {
            storedPrimaryId = prefs.primaryId;
          }
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
      ] = await Promise.all([
        supabase
          .from('categories')
          .select('id,account_id,name,type')
          .or(`account_id.in.(${accountIdList}),account_id.is.null`)
          .order('name', { ascending: true }),
        supabase
          .from('tags')
          .select('id,account_id,name')
          .in('account_id', accountIds)
          .order('name', { ascending: true }),
        supabase
          .from('transactions')
          .select('id,account_id,category_id,amount,note,type,date,created_at')
          .in('account_id', accountIds)
          .order('date', { ascending: false })
          .limit(1000),
      ]);

      if (categoryError) throw categoryError;
      if (tagError) throw tagError;
      if (txError) throw txError;

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
      setLoading(false);
    }
  }, [checkRequiredSchemaColumns, user]);

  useEffect(() => {
    if (missingSchemaColumns.length === 0) return;

    const signature = missingSchemaColumns.slice().sort().join('|');
    if (signature === schemaAlertSignatureRef.current) return;

    schemaAlertSignatureRef.current = signature;
    Alert.alert(
      'Database migration required',
      `Missing columns: ${missingSchemaColumns.join(', ')}. Apply the latest Supabase migration and restart the app.`,
    );
  }, [missingSchemaColumns]);

  useEffect(() => {
    if (!user || hasLoadedOnceRef.current) return;
    hasLoadedOnceRef.current = true;
    void loadData();
  }, [loadData, user]);

  useEffect(() => {
    if (!isDesktopBrowser) {
      setViewModeOverride(null);
    }
  }, [isDesktopBrowser]);

  useEffect(() => {
    setSpendingCollapsed(!desktopView);
  }, [desktopView]);

  useEffect(() => {
    if (!showEntryModal) return;
    const t = setTimeout(() => amountInputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [showEntryModal]);

  useEffect(() => {
    setVisibleTransactionsCount(12);
  }, [selectedAccountId, interval, customStart, customEnd, transactions.length, selectedCategoryFilter]);

  const handleDashboardScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!hasMoreTransactions) return;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 220;

    if (!nearBottom) return;

    setVisibleTransactionsCount((prev) => {
      if (prev >= filteredSelectedTxs.length) return prev;
      return Math.min(prev + 12, filteredSelectedTxs.length);
    });
  }, [filteredSelectedTxs.length, hasMoreTransactions]);

  const cycleEntryAccount = useCallback(() => {
    if (accounts.length === 0) return;
    const idx = accounts.findIndex((a) => a.id === entryAccountId);
    const next = accounts[(idx + 1) % accounts.length];
    setEntryAccountId(next.id);
  }, [accounts, entryAccountId]);

  const appendNumpad = useCallback((char: string) => {
    setEntryAmount((prev) => {
      if (char === 'C') return '';
      if (char === '<') return prev.slice(0, -1);
      if (char === '.') {
        if (prev.includes('.')) return prev;
        return prev ? `${prev}.` : '0.';
      }
      return `${prev}${char}`;
    });
  }, []);

  const openEntryModal = useCallback((type: TransactionType, categoryId?: string | null) => {
    setEditingTransactionId(null);
    setEntryType(type);
    setEntryAmount('');
    setEntryDate(todayIso());
    setEntryCategoryId(categoryId ?? null);
    setEntryNote('');
    setEntryTagIds([]);
    setNewTagName('');
    setEntryAccountId(selectedAccountId);
    setShowEntryAccountPicker(false);
    setShowEntryModal(true);
  }, [selectedAccountId]);

  const openEditTransaction = useCallback((tx: AppTransaction) => {
    setEditingTransactionId(tx.id);
    setEntryType(tx.type);
    setEntryAmount(String(Math.abs(Number(tx.amount) || 0)));
    setEntryDate(tx.date);
    setEntryCategoryId(tx.category_id ?? null);
    setEntryNote(tx.note ?? '');
    setEntryTagIds(tx.tag_ids);
    setEntryAccountId(tx.account_id);
    setShowEntryAccountPicker(false);
    setShowEntryModal(true);
  }, []);

  const openCreateAccount = useCallback(() => {
    setEditingAccountId(null);
    setNewAccountName('');
    setNewAccountCurrency(selectedAccount?.currency ?? 'USD');
    setSettingsIncluded(true);
    setSettingsCarryOver(true);
    setSettingsInitialBalance('0');
    setSettingsInitialDate(todayIso());
    setShowAccountModal(true);
  }, [selectedAccount?.currency]);

  const openEditAccount = useCallback((account: AppAccount) => {
    const settings = accountSettings[account.id];
    setEditingAccountId(account.id);
    setNewAccountName(account.name);
    setNewAccountCurrency(account.currency);
    setSettingsIncluded(settings?.included_in_balance ?? true);
    setSettingsCarryOver(settings?.carry_over_balance ?? true);
    setSettingsInitialBalance(String(settings?.initial_balance ?? 0));
    setSettingsInitialDate(settings?.initial_balance_date ?? account.created_at?.slice(0, 10) ?? todayIso());
    setShowAccountModal(true);
  }, [accountSettings]);

  const deleteAccount = useCallback(async (account: AppAccount) => {
    if (!user || account.created_by !== user.id) {
      Alert.alert('Cannot remove account', 'Only the account owner can remove this account.');
      return;
    }

    if (accounts.length <= 1) {
      Alert.alert('Cannot remove account', 'Keep at least one account.');
      return;
    }

    setSaving(true);
    try {
      const { data: txRows, error: txRowsError } = await supabase
        .from('transactions')
        .select('id')
        .eq('account_id', account.id);
      if (txRowsError) throw txRowsError;

      const txIds = (txRows ?? []).map((row: { id: string }) => row.id);
      if (txIds.length > 0) {
        const { error: deleteTagLinksError } = await supabase
          .from('transaction_tags')
          .delete()
          .in('transaction_id', txIds);
        if (deleteTagLinksError) throw deleteTagLinksError;
      }

      const deletions = [
        supabase.from('transactions').delete().eq('account_id', account.id),
        supabase.from('tags').delete().eq('account_id', account.id),
        supabase.from('categories').delete().eq('account_id', account.id),
        supabase.from('account_invites').delete().eq('account_id', account.id),
        supabase.from('account_members').delete().eq('account_id', account.id),
        supabase.from('account_settings').delete().eq('account_id', account.id),
      ];

      for (const request of deletions) {
        const { error } = await request;
        if (error && !isMissingTableError(error)) throw error;
      }

      const { error: accountError } = await supabase
        .from('accounts')
        .delete()
        .eq('id', account.id);
      if (accountError) throw accountError;

      if (selectedAccountId === account.id) {
        const nextAccount = accounts.find((item) => item.id !== account.id) ?? null;
        pendingSelectedAccountIdRef.current = nextAccount?.id ?? null;
        setSelectedAccountId(nextAccount?.id ?? null);
      }

      setShowAccountModal(false);
      await loadData();
    } catch (err) {
      Alert.alert('Remove account failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [accounts, loadData, selectedAccountId, user]);

  const saveCategory = useCallback(async () => {
    if (!selectedAccountId) {
      Alert.alert('No account selected', 'Select an account first.');
      return;
    }

    if (!categoryName.trim()) {
      Alert.alert('Missing name', 'Provide a category name.');
      return;
    }

    setSaving(true);
    try {
      if (editingCategoryId) {
        const { error } = await supabase
          .from('categories')
          .update({ name: categoryName.trim(), type: categoryType })
          .eq('id', editingCategoryId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert({
          account_id: selectedAccountId,
          name: categoryName.trim(),
          type: categoryType,
        });
        if (error) throw error;
      }
      setShowCategoryModal(false);
      await loadData();
    } catch (err) {
      Alert.alert('Save category failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [categoryName, categoryType, editingCategoryId, loadData, selectedAccountId]);

  const deleteCategory = useCallback(async (categoryId: string) => {
    setSaving(true);
    try {
      const { error: unlinkError } = await supabase
        .from('transactions')
        .update({ category_id: null })
        .eq('category_id', categoryId);
      if (unlinkError) throw unlinkError;

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);
      if (error) throw error;

      setShowCategoryModal(false);
      await loadData();
    } catch (err) {
      Alert.alert('Remove category failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [loadData]);

  const createTag = useCallback(async () => {
    if (!entryAccountId) return;
    if (!newTagName.trim()) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({ account_id: entryAccountId, name: newTagName.trim() })
        .select('id,account_id,name')
        .single();

      if (error) throw error;
      if (data?.id) {
        setEntryTagIds((prev) => (prev.includes(data.id) ? prev : [...prev, data.id]));
      }
      setNewTagName('');
      await loadData();
    } catch (err) {
      Alert.alert('Create tag failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [entryAccountId, loadData, newTagName]);

  const openCreateTag = useCallback(() => {
    if (!selectedAccountId) {
      Alert.alert('No account selected', 'Select an account first.');
      return;
    }
    setEditingTagId(null);
    setTagName('');
    setShowTagModal(true);
  }, [selectedAccountId]);

  const openEditTag = useCallback((tag: AppTag) => {
    setEditingTagId(tag.id);
    setTagName(tag.name);
    setShowTagModal(true);
  }, []);

  const saveTag = useCallback(async () => {
    if (!selectedAccountId && !editingTagId) {
      Alert.alert('No account selected', 'Select an account first.');
      return;
    }
    if (!tagName.trim()) {
      Alert.alert('Missing name', 'Provide a tag name.');
      return;
    }

    setSaving(true);
    try {
      if (editingTagId) {
        const { error } = await supabase
          .from('tags')
          .update({ name: tagName.trim() })
          .eq('id', editingTagId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tags')
          .insert({ account_id: selectedAccountId, name: tagName.trim() });
        if (error) throw error;
      }

      setShowTagModal(false);
      await loadData();
    } catch (err) {
      Alert.alert('Save tag failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [editingTagId, loadData, selectedAccountId, tagName]);

  const deleteTag = useCallback(async (tagId: string) => {
    setSaving(true);
    try {
      const { error: relationError } = await supabase
        .from('transaction_tags')
        .delete()
        .eq('tag_id', tagId);
      if (relationError) throw relationError;

      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId);
      if (error) throw error;

      setShowTagModal(false);
      await loadData();
    } catch (err) {
      Alert.alert('Remove tag failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [loadData]);

  const toggleTag = useCallback((id: string) => {
    setEntryTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const saveEntry = useCallback(async () => {
    if (!user || !entryAccountId) {
      Alert.alert('Missing account', 'Choose an account first.');
      return;
    }

    const amount = parseAmount(entryAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount.');
      return;
    }

    if (entryDate.length !== 10) {
      Alert.alert('Invalid date', 'Date must be YYYY-MM-DD.');
      return;
    }

    setSaving(true);
    try {
      let txId = editingTransactionId;
      if (editingTransactionId) {
        const { error } = await supabase
          .from('transactions')
          .update({
            account_id: entryAccountId,
            category_id: entryCategoryId,
            amount,
            note: entryNote.trim() || null,
            type: entryType,
            date: entryDate,
          })
          .eq('id', editingTransactionId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('transactions')
          .insert({
            account_id: entryAccountId,
            category_id: entryCategoryId,
            amount,
            note: entryNote.trim() || null,
            type: entryType,
            date: entryDate,
            created_by: user.id,
          })
          .select('id')
          .single();
        if (error) throw error;
        txId = data?.id ?? null;
      }

      if (!txId) throw new Error('No transaction id.');

      const { error: deleteError } = await supabase
        .from('transaction_tags')
        .delete()
        .eq('transaction_id', txId);
      if (deleteError) throw deleteError;

      if (entryTagIds.length > 0) {
        const payload = entryTagIds.map((tagId) => ({ transaction_id: txId as string, tag_id: tagId }));
        const { error: tagInsertError } = await supabase.from('transaction_tags').insert(payload);
        if (tagInsertError) throw tagInsertError;
      }

      setShowEntryModal(false);
      await loadData();
    } catch (err) {
      Alert.alert('Save entry failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [
    editingTransactionId,
    entryAccountId,
    entryAmount,
    entryCategoryId,
    entryDate,
    entryNote,
    entryTagIds,
    entryType,
    loadData,
    user,
  ]);

  const saveAccount = useCallback(async () => {
    if (!user) return;
    if (!newAccountName.trim()) {
      Alert.alert('Missing name', 'Provide account name.');
      return;
    }

    const initial = parseAmount(settingsInitialBalance || '0');
    if (!Number.isFinite(initial)) {
      Alert.alert('Invalid initial balance', 'Provide a numeric opening balance.');
      return;
    }

    setSaving(true);
    try {
      let accountId = editingAccountId;

      if (editingAccountId) {
        const { error } = await supabase
          .from('accounts')
          .update({ name: newAccountName.trim(), currency: newAccountCurrency })
          .eq('id', editingAccountId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('accounts')
          .insert({ name: newAccountName.trim(), currency: newAccountCurrency, created_by: user.id })
          .select('id')
          .single();
        if (error) throw error;
        accountId = data?.id ?? null;
      }

      if (!accountId) {
        throw new Error('No account id returned.');
      }

      const withCarryResult = await supabase.from('account_settings').upsert({
        account_id: accountId,
        included_in_balance: settingsIncluded,
        carry_over_balance: settingsCarryOver,
        initial_balance: initial,
        initial_balance_date: settingsInitialDate,
      });

      let settingsError = withCarryResult.error;
      if (settingsError && isMissingColumnError(settingsError)) {
        const fallbackResult = await supabase.from('account_settings').upsert({
          account_id: accountId,
          included_in_balance: settingsIncluded,
          initial_balance: initial,
          initial_balance_date: settingsInitialDate,
        });
        settingsError = fallbackResult.error;
      }

      if (settingsError && !isMissingTableError(settingsError)) throw settingsError;

      pendingSelectedAccountIdRef.current = accountId;
      setSelectedAccountId(accountId);
      setEntryAccountId(accountId);

      if (!editingAccountId) {
        setNewAccountName('');
      }
      setShowAccountModal(false);
      await loadData();
    } catch (err) {
      Alert.alert('Save account failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [
    editingAccountId,
    loadData,
    newAccountCurrency,
    newAccountName,
    settingsCarryOver,
    settingsIncluded,
    settingsInitialBalance,
    settingsInitialDate,
    user,
  ]);

  const openTransfer = useCallback(() => {
    if (accounts.length < 2) {
      Alert.alert('Not enough accounts', 'Create at least two accounts for transfer.');
      return;
    }
    const from = selectedAccountId ?? accounts[0].id;
    const to = accounts.find((a) => a.id !== from)?.id ?? null;

    setTransferFromId(from);
    setTransferToId(to);
    setTransferSourceAmount('');
    setTransferRate('');
    setTransferTargetAmount('');
    setTransferDate(todayIso());
    setTransferNote('');
    setShowTransferModal(true);
  }, [accounts, selectedAccountId]);

  const saveTransfer = useCallback(async () => {
    if (!user || !transferFromId || !transferToId) {
      Alert.alert('Missing accounts', 'Select source and destination accounts.');
      return;
    }
    if (transferFromId === transferToId) {
      Alert.alert('Invalid transfer', 'Source and destination must be different.');
      return;
    }

    const sourceAmount = parseAmount(transferSourceAmount);
    if (!Number.isFinite(sourceAmount) || sourceAmount <= 0) {
      Alert.alert('Invalid source amount', 'Enter source amount.');
      return;
    }

    const fromAccount = accounts.find((a) => a.id === transferFromId);
    const toAccount = accounts.find((a) => a.id === transferToId);
    if (!fromAccount || !toAccount) {
      Alert.alert('Account not found', 'Please re-open transfer and try again.');
      return;
    }

    let targetAmount = parseAmount(transferTargetAmount);
    if (fromAccount.currency === toAccount.currency) {
      targetAmount = sourceAmount;
    } else if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      const rate = parseAmount(transferRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        Alert.alert('Missing conversion', 'Provide destination amount or exchange rate.');
        return;
      }
      targetAmount = sourceAmount * rate;
    }

    setSaving(true);
    try {
      const sourceNote = transferNote.trim() || `Transfer to ${toAccount.name}`;
      const targetNote = transferNote.trim() || `Transfer from ${fromAccount.name}`;

      // Find-or-create global "Transfer" categories so transfers don't appear as uncategorized
      const findOrCreateCat = async (type: 'expense' | 'income') => {
        const existing = await supabase
          .from('categories')
          .select('id')
          .is('account_id', null)
          .eq('name', 'Transfer')
          .eq('type', type)
          .maybeSingle();
        if (existing.data?.id) return existing.data.id as string;
        const created = await supabase
          .from('categories')
          .insert({ account_id: null, name: 'Transfer', type })
          .select('id')
          .single();
        return (created.data?.id ?? null) as string | null;
      };

      const [transferExpenseCatId, transferIncomeCatId] = await Promise.all([
        findOrCreateCat('expense'),
        findOrCreateCat('income'),
      ]);

      const { error: sourceError } = await supabase.from('transactions').insert({
        account_id: transferFromId,
        category_id: transferExpenseCatId,
        amount: sourceAmount,
        type: 'expense',
        note: sourceNote,
        date: transferDate,
        created_by: user.id,
      });
      if (sourceError) throw sourceError;

      const { error: targetError } = await supabase.from('transactions').insert({
        account_id: transferToId,
        category_id: transferIncomeCatId,
        amount: targetAmount,
        type: 'income',
        note: targetNote,
        date: transferDate,
        created_by: user.id,
      });
      if (targetError) throw targetError;

      setShowTransferModal(false);
      await loadData();
      Alert.alert('Transfer saved', `${formatCurrency(sourceAmount, fromAccount.currency)} -> ${formatCurrency(targetAmount, toAccount.currency)}`);
    } catch (err) {
      Alert.alert('Transfer failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [
    accounts,
    formatCurrency,
    loadData,
    transferDate,
    transferFromId,
    transferNote,
    transferRate,
    transferSourceAmount,
    transferTargetAmount,
    transferToId,
    user,
  ]);

  const loadManagedInvites = useCallback(async (accountId: string) => {
    const withName = await supabase
      .from('account_invites')
      .select('id,account_id,token,name,invited_by,expires_at,used_at')
      .eq('account_id', accountId)
      .order('expires_at', { ascending: false });

    if (withName.error && isMissingColumnError(withName.error)) {
      const fallback = await supabase
        .from('account_invites')
        .select('id,account_id,token,invited_by,expires_at,used_at')
        .eq('account_id', accountId)
        .order('expires_at', { ascending: false });
      if (fallback.error) throw fallback.error;

      setManagedInvites((fallback.data ?? []).map((row: any) => ({
        id: row.id,
        account_id: row.account_id,
        token: row.token,
        name: 'Invite token',
        expires_at: row.expires_at,
        used_at: row.used_at,
      })));
      return;
    }

    if (withName.error) throw withName.error;

    setManagedInvites((withName.data ?? []).map((row: any) => ({
      id: row.id,
      account_id: row.account_id,
      token: row.token,
      name: row.name ?? 'Invite token',
      expires_at: row.expires_at,
      used_at: row.used_at,
    })));
  }, []);

  const openInvitationsModal = useCallback(async () => {
    const nextAccountId = selectedAccountId ?? accounts[0]?.id ?? null;
    setInvitationAccountId(nextAccountId);
    setInviteName('');
    setInviteExpiresDays('7');
    setEditingInviteId(null);
    setJoinToken('');
    setShowInvitationsModal(true);

    if (!nextAccountId) {
      setManagedInvites([]);
      return;
    }

    try {
      await loadManagedInvites(nextAccountId);
    } catch (err) {
      Alert.alert('Invitations error', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [accounts, loadManagedInvites, selectedAccountId]);

  const saveInviteToken = useCallback(async () => {
    if (!user || !invitationAccountId) {
      Alert.alert('No account selected', 'Select an account first.');
      return;
    }

    const days = Math.max(1, parseAmount(inviteExpiresDays || '7'));
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

    setSaving(true);
    try {
      if (editingInviteId) {
        const withName = await supabase
          .from('account_invites')
          .update({ name: inviteName.trim() || 'Invite token', expires_at: expiresAt })
          .eq('id', editingInviteId);

        if (withName.error && isMissingColumnError(withName.error)) {
          const fallback = await supabase
            .from('account_invites')
            .update({ expires_at: expiresAt })
            .eq('id', editingInviteId);
          if (fallback.error) throw fallback.error;
        } else if (withName.error) {
          throw withName.error;
        }
      } else {
        const token = `finduo_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-5)}`;
        const withName = await supabase.from('account_invites').insert({
          account_id: invitationAccountId,
          invited_by: user.id,
          token,
          name: inviteName.trim() || 'Invite token',
          expires_at: expiresAt,
        });

        if (withName.error && isMissingColumnError(withName.error)) {
          const fallback = await supabase.from('account_invites').insert({
            account_id: invitationAccountId,
            invited_by: user.id,
            token,
            expires_at: expiresAt,
          });
          if (fallback.error) throw fallback.error;
        } else if (withName.error) {
          throw withName.error;
        }

        setInviteToken(token);
      }

      setInviteName('');
      setInviteExpiresDays('7');
      setEditingInviteId(null);
      await loadManagedInvites(invitationAccountId);
    } catch (err) {
      Alert.alert('Invite save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [editingInviteId, invitationAccountId, inviteExpiresDays, inviteName, loadManagedInvites, user]);

  const removeInviteToken = useCallback(async (inviteId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('account_invites')
        .delete()
        .eq('id', inviteId);
      if (error) throw error;

      if (invitationAccountId) {
        await loadManagedInvites(invitationAccountId);
      }
    } catch (err) {
      Alert.alert('Remove invite failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [invitationAccountId, loadManagedInvites]);

  const joinByToken = useCallback(async () => {
    if (!user || !joinToken.trim()) {
      Alert.alert('Missing token', 'Paste token first.');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('account_invites')
        .select('id,account_id,token,invited_by,expires_at,used_at')
        .eq('token', joinToken.trim())
        .single();
      if (error) throw error;

      const invite = data as AccountInvite;
      if (invite.used_at) {
        Alert.alert('Used token', 'This invite is already used.');
        return;
      }
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        Alert.alert('Expired token', 'This invite token expired.');
        return;
      }

      const { error: memberError } = await supabase.from('account_members').insert({
        account_id: invite.account_id,
        user_id: user.id,
        role: 'member',
      });
      if (memberError) throw memberError;

      const { error: usedError } = await supabase
        .from('account_invites')
        .update({ used_at: new Date().toISOString() })
        .eq('id', invite.id);
      if (usedError) throw usedError;

      setJoinToken('');
      if (invitationAccountId) {
        await loadManagedInvites(invitationAccountId);
      }
      await loadData();
      Alert.alert('Joined', 'Shared account added.');
    } catch (err) {
      Alert.alert('Join failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [invitationAccountId, joinToken, loadData, loadManagedInvites, user]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#53E3A6" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.appShell}>
      <View
        style={[
          styles.surfaceFrame,
          desktopView && styles.surfaceFrameDesktop,
          framedMobileView && styles.surfaceFrameMobile,
        ]}
      >
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => {
                setMenuAccountsExpanded(false);
                setMenuCategoriesExpanded(false);
                setMenuTagsExpanded(false);
                setMenuOpen(true);
              }}
            >
              {user?.user_metadata?.avatar_url ? (
                <Image
                  source={{ uri: user.user_metadata.avatar_url as string }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {(user?.email?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
            </View>
            {isDesktopBrowser && (
              <View style={styles.viewToggleRow}>
                <TouchableOpacity
                  style={[styles.viewToggleButton, desktopView && styles.viewToggleButtonActive]}
                  onPress={() => setViewModeOverride('desktop')}
                >
                  <Text style={styles.viewToggleText}>Desktop</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewToggleButton, framedMobileView && styles.viewToggleButtonActive]}
                  onPress={() => setViewModeOverride('mobile')}
                >
                  <Text style={styles.viewToggleText}>Mobile</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            onScroll={handleDashboardScroll}
            scrollEventThrottle={16}
          >
            {missingSchemaColumns.length > 0 && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningBannerTitle}>Database update needed</Text>
                <Text style={styles.warningBannerText}>
                  Missing columns: {missingSchemaColumns.join(', ')}
                </Text>
                <Text style={styles.warningBannerText}>
                  Run migration: supabase/migrations/20260326_add_carry_over_and_invite_name.sql
                </Text>
              </View>
            )}

            <View style={desktopView ? styles.desktopTwoColRow : undefined}>
              {/* Left (or solo on mobile): overview card + account picker */}
              <View style={desktopView ? styles.desktopColLeft : undefined}>
                <View style={styles.cardStrong}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setShowAccountOverviewPicker((prev) => !prev)}
                  >
                    <View style={styles.cardCollapseHeader}>
                      <Text style={styles.cardStrongLabel}>
                        {showAccountOverviewPicker ? 'Included Accounts Total' : 'Selected Account Balance'}
                      </Text>
                      <TouchableOpacity onPress={() => setOverviewCollapsed((p) => !p)}>
                        <Text style={styles.collapseChevron}>{overviewCollapsed ? '▸' : '▾'}</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.cardStrongValue, overviewSummary.net < 0 && styles.negative]}>
                      {formatCurrency(overviewSummary.net)}
                    </Text>
                  </TouchableOpacity>
                  {!overviewCollapsed && (
                    <>
                      <Text style={styles.summaryText}>
                        Account: {showAccountOverviewPicker ? 'All Included Accounts' : (selectedAccount?.name ?? 'No account selected')}
                      </Text>
                      {/* Interval pill inline selector */}
                      <View style={styles.intervalPillRow}>
                        <TouchableOpacity
                          style={styles.intervalPill}
                          onPress={() => setShowIntervalPicker((p) => !p)}
                        >
                          <Text style={styles.intervalPillText}>{interval.toUpperCase()} {showIntervalPicker ? '▾' : '▸'}</Text>
                        </TouchableOpacity>
                      </View>
                      {showIntervalPicker && (
                        <View style={styles.intervalPickerWrap}>
                          <View style={styles.menuChipWrap}>
                            {(['day', 'week', 'month', 'year', 'all', 'custom'] as IntervalKey[]).map((key) => (
                              <TouchableOpacity
                                key={key}
                                style={[styles.menuChip, interval === key && styles.menuChipActive]}
                                onPress={() => { setInterval(key); if (key !== 'custom') setShowIntervalPicker(false); }}
                              >
                                <Text style={styles.menuChipText}>{key.toUpperCase()}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          {interval === 'custom' && (
                            <View style={styles.customRangeStack}>
                              <TextInput
                                value={customStart}
                                onChangeText={setCustomStart}
                                placeholder="Start YYYY-MM-DD"
                                placeholderTextColor="#64748B"
                                style={styles.input}
                              />
                              <TextInput
                                value={customEnd}
                                onChangeText={setCustomEnd}
                                placeholder="End YYYY-MM-DD"
                                placeholderTextColor="#64748B"
                                style={styles.input}
                              />
                            </View>
                          )}
                        </View>
                      )}
                      <Text style={styles.summaryText}>Opening: {formatCurrency(overviewSummary.openingBalance)}</Text>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryText}>Income {formatCurrency(overviewSummary.income)}</Text>
                        <Text style={styles.summaryText}>Expenses {formatCurrency(overviewSummary.expense)}</Text>
                      </View>
                      <Text style={styles.summaryText}>Total Included Balance: {formatCurrency(totalIncludedBalance)}</Text>
                      {includedAccountSummaries.length > 1 && (
                        <Text style={styles.summaryText}>
                          Tap to {showAccountOverviewPicker ? 'hide accounts' : 'change account'}
                        </Text>
                      )}
                    </>
                  )}
                </View>

                {includedAccountSummaries.length > 1 && showAccountOverviewPicker && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Included Accounts Overview</Text>
                    </View>
                    <View style={styles.accountOverviewGrid}>
                      {includedAccountSummaries.map((item) => (
                        <TouchableOpacity
                          key={item.account.id}
                          style={[
                            styles.accountOverviewCard,
                            selectedAccountId === item.account.id && styles.accountOverviewCardActive,
                          ]}
                          onPress={() => {
                            setSelectedAccountId(item.account.id);
                            setShowAccountOverviewPicker(false);
                          }}
                        >
                          <Text style={styles.accountOverviewName}>{item.account.name}</Text>
                          <Text style={[styles.accountOverviewValue, item.balance < 0 && styles.negative]}>
                            {formatCurrency(item.balance, item.account.currency)}
                          </Text>
                          <Text style={styles.accountOverviewMeta}>In {formatCurrency(item.income, item.account.currency)}</Text>
                          <Text style={styles.accountOverviewMeta}>Out {formatCurrency(item.expense, item.account.currency)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </View>

              {/* Right (or below on mobile): spending by category */}
              <View style={desktopView ? styles.desktopColRight : undefined}>
                <View style={[styles.cardStrong, { marginBottom: 18 }]}>
                  <View style={[styles.cardCollapseHeader, { marginBottom: spendingCollapsed ? 0 : 12 }]}>
                    <Text style={styles.cardStrongLabel}>SPENDING BY CATEGORY</Text>
                    <View style={styles.cardCollapseHeaderRight}>
                      {selectedCategoryFilter && !spendingCollapsed && (
                        <TouchableOpacity onPress={() => setSelectedCategoryFilter(null)}>
                          <Text style={styles.linkAction}>✕ Clear</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => setSpendingCollapsed((p) => !p)}>
                        <Text style={styles.collapseChevron}>{spendingCollapsed ? '▸' : '▾'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {!spendingCollapsed && (
                    categorySpendData.length === 0 ? (
                      <Text style={styles.emptyText}>No expense data in this interval.</Text>
                    ) : (
                      <>
                        {categorySpendData.map((row) => {
                          const isActive = selectedCategoryFilter === row.id;
                          return (
                            <TouchableOpacity
                              key={row.id}
                              style={[styles.spendRow, isActive && styles.spendRowActive]}
                              activeOpacity={0.7}
                              onPress={() => setSelectedCategoryFilter(isActive ? null : row.id)}
                            >
                              <View style={styles.spendLabelRow}>
                                <Text style={[styles.spendName, isActive && styles.spendNameActive]}>{row.name}</Text>
                                <Text style={styles.spendAmount}>{formatCurrency(row.total)}</Text>
                              </View>
                              <View style={styles.spendBarTrack}>
                                <View style={[styles.spendBarFill, { width: `${row.widthPercent}%` }, isActive && styles.spendBarFillActive]} />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </>
                    )
                  )}
                </View>
              </View>
            </View>

            {/* Desktop battery chart */}
            {desktopView && (() => {
              const totalAvailable = overviewSummary.openingBalance + overviewSummary.income;
              const spent = overviewSummary.expense;
              const unspent = totalAvailable - spent;
              const spentPct = totalAvailable > 0 ? Math.min(100, Math.round((spent / totalAvailable) * 100)) : 0;
              const unspentPct = 100 - spentPct;
              return (
                <View style={styles.batteryWrap}>
                  <View style={styles.batteryTrack}>
                    {totalAvailable <= 0 ? (
                      <View style={[styles.batterySegmentUnspent, { flex: 1 }]}>
                        <Text style={styles.batterySegLabel}>No data</Text>
                      </View>
                    ) : (
                      <>
                        {spentPct > 0 && (
                          <View style={[styles.batterySegmentSpent, { flex: spentPct }]}>
                            {spentPct >= 12 && <Text style={styles.batterySegLabel}>{spentPct}%</Text>}
                          </View>
                        )}
                        {unspentPct > 0 && (
                          <View style={[styles.batterySegmentUnspent, { flex: unspentPct }]}>
                            {unspentPct >= 12 && <Text style={styles.batterySegLabel}>{unspentPct}%</Text>}
                          </View>
                        )}
                      </>
                    )}
                  </View>
                  <View style={styles.batteryLegend}>
                    <View style={styles.batteryLegendItem}>
                      <View style={[styles.batteryLegendDot, { backgroundColor: '#FB7185' }]} />
                      <Text style={styles.batteryLegendText}>Spent {formatCurrency(spent)} ({spentPct}%)</Text>
                    </View>
                    <View style={styles.batteryLegendItem}>
                      <View style={[styles.batteryLegendDot, { backgroundColor: '#53E3A6' }]} />
                      <Text style={styles.batteryLegendText}>Remaining {formatCurrency(Math.max(0, unspent))} ({unspentPct}%)</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionTitle}>Categories</Text>
                {desktopView && (
                  <TouchableOpacity onPress={() => setCategoriesCollapsed((p) => !p)} style={styles.collapseTrigger}>
                    <Text style={styles.collapseChevron}>{categoriesCollapsed ? '▸' : '▾'}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={() => {
                setEditingCategoryId(null);
                setCategoryName('');
                setCategoryType('expense');
                setShowCategoryModal(true);
              }}>
                <Text style={styles.linkAction}>+ New</Text>
              </TouchableOpacity>
            </View>

            {(!desktopView || !categoriesCollapsed) && (
            <View style={styles.chipsWrap}>
              {sortedSelectedCategories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.categoryChip}
                  onPress={() => openEntryModal(c.type, c.id)}
                  onLongPress={() => {
                    setEditingCategoryId(c.id);
                    setCategoryName(c.name);
                    setCategoryType(c.type);
                    setShowCategoryModal(true);
                  }}
                >
                  <Text style={styles.categoryChipText}>{c.name}</Text>
                  <Text style={[styles.categoryChipType, c.type === 'income' && styles.incomeType]}>{c.type}</Text>
                </TouchableOpacity>
              ))}
            </View>
            )}

            <View style={styles.sectionHeader}>
              {selectedCategoryFilter ? (
                <View style={styles.filterLabelRow}>
                  <Text style={styles.sectionTitle}>
                    {categorySpendData.find((r) => r.id === selectedCategoryFilter)?.name ?? 'Category'}
                  </Text>
                  <Text style={styles.filterLabelSub}> transactions</Text>
                </View>
              ) : (
                <Text style={styles.sectionTitle}>Recent Transactions</Text>
              )}
              <View style={styles.sectionHeaderActions}>
                {selectedCategoryFilter && (
                  <TouchableOpacity onPress={() => setSelectedCategoryFilter(null)}>
                    <Text style={styles.linkAction}>✕ All</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => openEntryModal('expense', filterIsExpense ? selectedCategoryFilter : null)}>
                  <Text style={styles.linkAction}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.listCard}>
              {(selectedCategoryFilter ? categoryFilteredTxsVisible ?? [] : visibleSelectedTxs).map((tx) => (
                <TouchableOpacity key={tx.id} style={styles.transactionRow} onPress={() => openEditTransaction(tx)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.transactionTitle}>{tx.note || 'Untitled transaction'}</Text>
                    <Text style={styles.transactionMeta}>{tx.date} • {formatShortDate(tx.created_at)}</Text>
                  </View>
                  <Text style={[styles.transactionAmount, tx.type === 'income' ? styles.positive : styles.negative]}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount) || 0)}
                  </Text>
                </TouchableOpacity>
              ))}
              {(selectedCategoryFilter ? (categoryFilteredTxsVisible?.length ?? 0) : visibleSelectedTxs.length) === 0 && (
                <Text style={styles.emptyText}>No transactions in this interval.</Text>
              )}
              {hasMoreTransactions && !selectedCategoryFilter && (
                <Text style={styles.transactionMeta}>Scroll down to load more transactions</Text>
              )}
            </View>

            {!!inviteToken && (
              <View style={styles.pendingCard}>
                <Text style={styles.pendingTitle}>Latest invite token</Text>
                <Text style={styles.pendingAccountName}>{inviteToken}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.bottomBarIncome, filterIsExpense && styles.bottomBarDisabled]}
              onPress={() => !filterIsExpense && openEntryModal('income', null)}
              accessibilityLabel="Add income"
            >
              <Text style={styles.bottomBarIcon}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bottomBarTransfer, filterIsExpense && styles.bottomBarDisabled]}
              onPress={() => !filterIsExpense && openTransfer()}
              accessibilityLabel="Transfer between accounts"
            >
              <Text style={styles.bottomBarIcon}>⇄</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomBarExpense}
              onPress={() => openEntryModal('expense', filterIsExpense ? selectedCategoryFilter : null)}
              accessibilityLabel="Add expense"
            >
              <Text style={styles.bottomBarIcon}>↓</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal visible={menuOpen} transparent animationType="none" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuOverlay}>
          <Pressable style={styles.menuOverlayTapArea} onPress={() => setMenuOpen(false)} />
          <View style={styles.menuPanel}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuScrollContent}>
              <Text style={styles.menuTitle}>Quick Navigation</Text>

              <View style={styles.menuSectionHeader}>
                <TouchableOpacity onPress={() => setMenuAccountsExpanded((prev) => !prev)}>
                  <Text style={styles.menuSectionTitle}>Accounts {menuAccountsExpanded ? '▾' : '▸'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuIconAction} onPress={() => {
                  setMenuOpen(false);
                  openCreateAccount();
                }}>
                  <Text style={styles.menuIconActionText}>＋</Text>
                </TouchableOpacity>
              </View>
              {menuAccountsExpanded && accounts.map((account, accountIdx) => {
                const isOwned = account.created_by === user?.id;
                const isPrimary = account.id === primaryAccountId;
                return (
                  <View key={account.id} style={styles.manageRow}>
                    <TouchableOpacity
                      style={styles.managePrimary}
                      onPress={() => {
                        setSelectedAccountId(account.id);
                        setMenuOpen(false);
                      }}
                    >
                      <View style={styles.manageNameRow}>
                        {isPrimary && <Text style={styles.managePrimaryBadge}>★ </Text>}
                        <Text style={styles.manageTitle}>{account.name}</Text>
                      </View>
                      <Text style={styles.manageMeta}>
                        {account.currency}
                        {' • '}
                        {(accountSettings[account.id]?.included_in_balance ?? true) ? 'Included' : 'Excluded'}
                        {' • '}
                        {(accountSettings[account.id]?.carry_over_balance ?? true) ? 'Carry over' : 'No carry over'}
                      </Text>
                    </TouchableOpacity>

                    {/* Reorder up */}
                    <TouchableOpacity
                      style={[styles.manageSmallButton, accountIdx === 0 && styles.manageSmallButtonDisabled]}
                      onPress={() => moveAccount(accountIdx, 'up')}
                      disabled={accountIdx === 0}
                    >
                      <Text style={styles.manageSmallText}>↑</Text>
                    </TouchableOpacity>

                    {/* Reorder down */}
                    <TouchableOpacity
                      style={[styles.manageSmallButton, accountIdx === accounts.length - 1 && styles.manageSmallButtonDisabled]}
                      onPress={() => moveAccount(accountIdx, 'down')}
                      disabled={accountIdx === accounts.length - 1}
                    >
                      <Text style={styles.manageSmallText}>↓</Text>
                    </TouchableOpacity>

                    {/* Set as primary */}
                    <TouchableOpacity
                      style={[styles.manageSmallButton, isPrimary && styles.manageSmallButtonActive]}
                      onPress={() => setPrimary(account.id)}
                    >
                      <Text style={[styles.manageSmallText, isPrimary && styles.manageSmallTextActive]}>★</Text>
                    </TouchableOpacity>

                    {isOwned ? (
                      <>
                        <TouchableOpacity style={styles.manageIconButton} onPress={() => {
                          setMenuOpen(false);
                          openEditAccount(account);
                        }}>
                          <Text style={styles.manageIconText}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.manageIconButtonDanger} onPress={() => {
                          Alert.alert('Remove account', `Remove ${account.name}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Remove',
                              style: 'destructive',
                              onPress: () => {
                                setMenuOpen(false);
                                void deleteAccount(account);
                              },
                            },
                          ]);
                        }}>
                          <Text style={styles.manageIconText}>✕</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <Text style={styles.managePill}>Shared</Text>
                    )}
                  </View>
                );
              })}

              <View style={styles.menuSectionHeader}>
                <TouchableOpacity onPress={() => setMenuCategoriesExpanded((prev) => !prev)}>
                  <Text style={styles.menuSectionTitle}>Categories {menuCategoriesExpanded ? '▾' : '▸'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuIconAction} onPress={() => {
                  setMenuOpen(false);
                  setEditingCategoryId(null);
                  setCategoryName('');
                  setCategoryType('expense');
                  setShowCategoryModal(true);
                }}>
                  <Text style={styles.menuIconActionText}>＋</Text>
                </TouchableOpacity>
              </View>
              {menuCategoriesExpanded && selectedCategories.map((category) => (
                <View key={category.id} style={styles.manageRow}>
                  <TouchableOpacity
                    style={styles.managePrimary}
                    onPress={() => {
                      setMenuOpen(false);
                      openEntryModal(category.type, category.id);
                    }}
                  >
                    <Text style={styles.manageTitle}>{category.name}</Text>
                    <Text style={styles.manageMeta}>{category.type.toUpperCase()}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.manageIconButton} onPress={() => {
                    setMenuOpen(false);
                    setEditingCategoryId(category.id);
                    setCategoryName(category.name);
                    setCategoryType(category.type);
                    setShowCategoryModal(true);
                  }}>
                    <Text style={styles.manageIconText}>✎</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.manageIconButtonDanger} onPress={() => {
                    Alert.alert('Remove category', `Remove ${category.name}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => {
                          setMenuOpen(false);
                          void deleteCategory(category.id);
                        },
                      },
                    ]);
                  }}>
                    <Text style={styles.manageIconText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.menuSectionHeader}>
                <TouchableOpacity onPress={() => setMenuTagsExpanded((prev) => !prev)}>
                  <Text style={styles.menuSectionTitle}>Tags {menuTagsExpanded ? '▾' : '▸'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuIconAction} onPress={() => {
                  setMenuOpen(false);
                  openCreateTag();
                }}>
                  <Text style={styles.menuIconActionText}>＋</Text>
                </TouchableOpacity>
              </View>
              {menuTagsExpanded && selectedTags.map((tag) => (
                <View key={tag.id} style={styles.manageRow}>
                  <View style={styles.managePrimary}>
                    <Text style={styles.manageTitle}>#{tag.name}</Text>
                    <Text style={styles.manageMeta}>{accounts.find((a) => a.id === tag.account_id)?.name ?? 'Global'}</Text>
                  </View>
                  <TouchableOpacity style={styles.manageIconButton} onPress={() => {
                    setMenuOpen(false);
                    openEditTag(tag);
                  }}>
                    <Text style={styles.manageIconText}>✎</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.manageIconButtonDanger} onPress={() => {
                    Alert.alert('Remove tag', `Remove #${tag.name}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => {
                          setMenuOpen(false);
                          void deleteTag(tag.id);
                        },
                      },
                    ]);
                  }}>
                    <Text style={styles.manageIconText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <Text style={styles.menuSectionTitle}>Interval</Text>
              <View style={styles.menuChipWrap}>
                {(['day', 'week', 'month', 'year', 'all', 'custom'] as IntervalKey[]).map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.menuChip, interval === key && styles.menuChipActive]}
                    onPress={() => setInterval(key)}
                  >
                    <Text style={styles.menuChipText}>{key.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {interval === 'custom' && (
                <View style={styles.customRangeStack}>
                  <TextInput
                    value={customStart}
                    onChangeText={setCustomStart}
                    placeholder="Start YYYY-MM-DD"
                    placeholderTextColor="#64748B"
                    style={styles.input}
                  />
                  <TextInput
                    value={customEnd}
                    onChangeText={setCustomEnd}
                    placeholder="End YYYY-MM-DD"
                    placeholderTextColor="#64748B"
                    style={styles.input}
                  />
                </View>
              )}

              <TouchableOpacity style={styles.menuItem} onPress={() => void loadData()}>
                <Text style={styles.menuItemText}>Reload dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => {
                setMenuOpen(false);
                void openInvitationsModal();
              }}>
                <Text style={styles.menuItemText}>Invitations</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuDanger} onPress={signOut}>
                <Text style={styles.menuDangerText}>Sign out</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showEntryModal} transparent animationType="none" onRequestClose={() => setShowEntryModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowEntryModal(false)}>
          <Pressable style={[styles.modalCard, styles.entryModalCard]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.entryTopRow}>
              <TextInput
                ref={dateInputRef}
                value={entryDate}
                onChangeText={setEntryDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#64748B"
                style={[styles.input, styles.entryDateInput]}
                returnKeyType="next"
                onSubmitEditing={() => noteInputRef.current?.focus()}
              />
              <TouchableOpacity
                style={[styles.entryAccountBtn, showEntryAccountPicker && styles.entryAccountBtnActive]}
                onPress={() => setShowEntryAccountPicker((p) => !p)}
              >
                <Text style={styles.entryAccountBtnText}>{entryAccount?.name ?? 'Account'} {showEntryAccountPicker ? '▾' : '▸'}</Text>
              </TouchableOpacity>
            </View>
            {showEntryAccountPicker && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.modalChipsRow, { marginBottom: 8 }]}>
                {accounts.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.modalChip, entryAccountId === a.id && styles.modalChipActive]}
                    onPress={() => { setEntryAccountId(a.id); setShowEntryAccountPicker(false); }}
                  >
                    <Text style={styles.modalChipText}>{a.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.entryTypeRow}>
              <TouchableOpacity
                style={[styles.toggleButton, entryType === 'income' && styles.toggleButtonActive]}
                onPress={() => setEntryType('income')}
              >
                <Text style={styles.toggleButtonText}>Income</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, entryType === 'expense' && styles.toggleButtonActive]}
                onPress={() => setEntryType('expense')}
              >
                <Text style={styles.toggleButtonText}>Expense</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              ref={amountInputRef}
              autoFocus
              value={entryAmount}
              onChangeText={setEntryAmount}
              placeholder="0"
              placeholderTextColor="#64748B"
              keyboardType="decimal-pad"
              style={styles.entryAmountInput}
              returnKeyType="next"
              onSubmitEditing={() => dateInputRef.current?.focus()}
              showSoftInputOnFocus={Platform.OS !== 'android'}
            />
            <Text style={styles.entryCurrencyText}>{entryAccount?.currency ?? selectedCurrency}</Text>

            {recentCategoryAmounts.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipsRow}>
                {recentCategoryAmounts.map((v) => (
                  <TouchableOpacity key={`${entryType}-${v}`} style={styles.modalChip} onPress={() => setEntryAmount(String(v))}>
                    <Text style={styles.modalChipText}>{formatCurrency(v, entryAccount?.currency)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.numpadGrid}>
              {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '<'].map((k) => (
                <TouchableOpacity key={k} style={styles.numpadKey} onPress={() => appendNumpad(k)}>
                  <Text style={styles.numpadKeyText}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              ref={noteInputRef}
              value={entryNote}
              onChangeText={setEntryNote}
              placeholder="Note"
              placeholderTextColor="#64748B"
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={() => void saveEntry()}
              onFocus={() => setNoteFieldFocused(true)}
              onBlur={() => setTimeout(() => setNoteFieldFocused(false), 150)}
            />
            {noteFieldFocused && noteSuggestions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.modalChipsRow, { marginBottom: 6 }]}>
                {noteSuggestions.map((s) => (
                  <TouchableOpacity key={s} style={styles.modalChip} onPress={() => setEntryNote(s)}>
                    <Text style={styles.modalChipText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={styles.modalLabel}>Tags</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipsRow}>
              {entryTags.map((tag) => (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.modalChip, entryTagIds.includes(tag.id) && styles.modalChipActive]}
                  onPress={() => toggleTag(tag.id)}
                >
                  <Text style={styles.modalChipText}>#{tag.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.tagCreateRow}>
              <TextInput
                placeholder="New tag"
                placeholderTextColor="#64748B"
                value={newTagName}
                onChangeText={setNewTagName}
                style={[styles.input, styles.tagInput]}
              />
              <TouchableOpacity style={styles.smallAction} onPress={() => void createTag()}>
                <Text style={styles.smallActionText}>Add Tag</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipsRow}>
              {entryCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.modalChip, entryCategoryId === cat.id && styles.modalChipActive]}
                  onPress={() => setEntryCategoryId(cat.id)}
                >
                  <Text style={styles.modalChipText}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondary} onPress={() => setShowEntryModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimary} onPress={() => void saveEntry()} disabled={saving}>
                <Text style={styles.modalPrimaryText}>{editingTransactionId ? 'Update' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showCategoryModal} transparent animationType="none" onRequestClose={() => setShowCategoryModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCategoryModal(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{editingCategoryId ? 'Edit category' : 'Create category'}</Text>
            <TextInput
              placeholder="Category name"
              placeholderTextColor="#64748B"
              value={categoryName}
              onChangeText={setCategoryName}
              style={styles.input}
            />
            <View style={styles.entryTypeRow}>
              <TouchableOpacity
                style={[styles.toggleButton, categoryType === 'income' && styles.toggleButtonActive]}
                onPress={() => setCategoryType('income')}
              >
                <Text style={styles.toggleButtonText}>Income</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, categoryType === 'expense' && styles.toggleButtonActive]}
                onPress={() => setCategoryType('expense')}
              >
                <Text style={styles.toggleButtonText}>Expense</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalActions}>
              {editingCategoryId && (
                <TouchableOpacity
                  style={styles.modalDanger}
                  onPress={() => {
                    Alert.alert('Remove category', 'Delete this category?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => {
                          void deleteCategory(editingCategoryId);
                        },
                      },
                    ]);
                  }}
                >
                  <Text style={styles.modalDangerText}>Remove</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.modalSecondary} onPress={() => setShowCategoryModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimary} onPress={() => void saveCategory()} disabled={saving}>
                <Text style={styles.modalPrimaryText}>{editingCategoryId ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showAccountModal} transparent animationType="none" onRequestClose={() => setShowAccountModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAccountModal(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{editingAccountId ? 'Edit account' : 'Create account'}</Text>
            <TextInput
              placeholder="Account name"
              placeholderTextColor="#64748B"
              value={newAccountName}
              onChangeText={setNewAccountName}
              style={styles.input}
            />
            <Text style={styles.modalLabel}>Currency</Text>
            <View style={styles.currencyGrid}>
              {CURRENCY_OPTIONS.map((code) => (
                <TouchableOpacity
                  key={code}
                  style={[styles.currencyOption, newAccountCurrency === code && styles.currencyOptionActive]}
                  onPress={() => setNewAccountCurrency(code)}
                >
                  <Text style={styles.currencyOptionText}>{code}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Included in balance</Text>
            <View style={styles.toggleRowCompact}>
              <TouchableOpacity
                style={[styles.modalChip, settingsIncluded && styles.modalChipActive]}
                onPress={() => setSettingsIncluded(true)}
              >
                <Text style={styles.modalChipText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalChip, !settingsIncluded && styles.modalChipActive]}
                onPress={() => setSettingsIncluded(false)}
              >
                <Text style={styles.modalChipText}>No</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Carry balance over interval</Text>
            <View style={styles.toggleRowCompact}>
              <TouchableOpacity
                style={[styles.modalChip, settingsCarryOver && styles.modalChipActive]}
                onPress={() => setSettingsCarryOver(true)}
              >
                <Text style={styles.modalChipText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalChip, !settingsCarryOver && styles.modalChipActive]}
                onPress={() => setSettingsCarryOver(false)}
              >
                <Text style={styles.modalChipText}>No</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Initial account balance"
              placeholderTextColor="#64748B"
              keyboardType="decimal-pad"
              value={settingsInitialBalance}
              onChangeText={setSettingsInitialBalance}
              style={styles.input}
            />
            <TextInput
              placeholder="Initial balance date (YYYY-MM-DD)"
              placeholderTextColor="#64748B"
              value={settingsInitialDate}
              onChangeText={setSettingsInitialDate}
              style={styles.input}
            />

            <View style={styles.modalActions}>
              {editingAccountId && editingAccount && editingAccount.created_by === user?.id && (
                <TouchableOpacity
                  style={styles.modalDanger}
                  onPress={() => {
                    Alert.alert('Remove account', `Remove ${editingAccount.name}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => {
                          void deleteAccount(editingAccount);
                        },
                      },
                    ]);
                  }}
                >
                  <Text style={styles.modalDangerText}>Remove</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.modalSecondary} onPress={() => setShowAccountModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimary} onPress={() => void saveAccount()} disabled={saving}>
                <Text style={styles.modalPrimaryText}>{editingAccountId ? 'Save' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showTagModal} transparent animationType="none" onRequestClose={() => setShowTagModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTagModal(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{editingTagId ? 'Edit tag' : 'Create tag'}</Text>
            <TextInput
              placeholder="Tag name"
              placeholderTextColor="#64748B"
              value={tagName}
              onChangeText={setTagName}
              style={styles.input}
            />

            <View style={styles.modalActions}>
              {editingTagId && (
                <TouchableOpacity
                  style={styles.modalDanger}
                  onPress={() => {
                    const idToDelete = editingTagId;
                    Alert.alert('Remove tag', 'Delete this tag?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => {
                          void deleteTag(idToDelete);
                        },
                      },
                    ]);
                  }}
                >
                  <Text style={styles.modalDangerText}>Remove</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.modalSecondary} onPress={() => setShowTagModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimary} onPress={() => void saveTag()} disabled={saving}>
                <Text style={styles.modalPrimaryText}>{editingTagId ? 'Save' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showTransferModal} transparent animationType="none" onRequestClose={() => setShowTransferModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTransferModal(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Transfer Between Accounts</Text>

            <Text style={styles.modalLabel}>From account</Text>
            <View style={styles.currencyGrid}>
              {accounts.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.currencyOption, transferFromId === a.id && styles.currencyOptionActive]}
                  onPress={() => setTransferFromId(a.id)}
                >
                  <Text style={styles.currencyOptionText}>{a.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>To account</Text>
            <View style={styles.currencyGrid}>
              {accounts.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.currencyOption, transferToId === a.id && styles.currencyOptionActive]}
                  onPress={() => setTransferToId(a.id)}
                >
                  <Text style={styles.currencyOptionText}>{a.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              placeholder="Source amount"
              placeholderTextColor="#64748B"
              keyboardType="decimal-pad"
              value={transferSourceAmount}
              onChangeText={setTransferSourceAmount}
              style={styles.input}
            />
            <TextInput
              placeholder="Exchange rate (optional)"
              placeholderTextColor="#64748B"
              keyboardType="decimal-pad"
              value={transferRate}
              onChangeText={setTransferRate}
              style={styles.input}
            />
            <TextInput
              placeholder="Destination amount (optional if rate given)"
              placeholderTextColor="#64748B"
              keyboardType="decimal-pad"
              value={transferTargetAmount}
              onChangeText={setTransferTargetAmount}
              style={styles.input}
            />
            <TextInput
              placeholder="Transfer date (YYYY-MM-DD)"
              placeholderTextColor="#64748B"
              value={transferDate}
              onChangeText={setTransferDate}
              style={styles.input}
            />
            <TextInput
              placeholder="Transfer note (optional)"
              placeholderTextColor="#64748B"
              value={transferNote}
              onChangeText={setTransferNote}
              style={styles.input}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondary} onPress={() => setShowTransferModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimary} onPress={() => void saveTransfer()} disabled={saving}>
                <Text style={styles.modalPrimaryText}>Save Transfer</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showInvitationsModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowInvitationsModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowInvitationsModal(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Invitations</Text>

            <Text style={styles.modalLabel}>Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipsRow}>
              {accounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={[styles.modalChip, invitationAccountId === account.id && styles.modalChipActive]}
                  onPress={() => {
                    setInvitationAccountId(account.id);
                    void loadManagedInvites(account.id);
                  }}
                >
                  <Text style={styles.modalChipText}>{account.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              placeholder="Invite name"
              placeholderTextColor="#64748B"
              value={inviteName}
              onChangeText={setInviteName}
              style={styles.input}
            />
            <TextInput
              placeholder="Expire in days (default 7)"
              placeholderTextColor="#64748B"
              keyboardType="number-pad"
              value={inviteExpiresDays}
              onChangeText={setInviteExpiresDays}
              style={styles.input}
            />

            <View style={styles.modalActions}>
              {editingInviteId && (
                <TouchableOpacity
                  style={styles.modalSecondary}
                  onPress={() => {
                    setEditingInviteId(null);
                    setInviteName('');
                    setInviteExpiresDays('7');
                  }}
                >
                  <Text style={styles.modalSecondaryText}>Clear Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.modalPrimary} onPress={() => void saveInviteToken()} disabled={saving}>
                <Text style={styles.modalPrimaryText}>{editingInviteId ? 'Save Token' : 'Create Token'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Existing tokens</Text>
            <ScrollView style={{ maxHeight: 210 }}>
              {managedInvites.length === 0 ? (
                <Text style={styles.emptyText}>No invitations for this account.</Text>
              ) : managedInvites.map((invite) => (
                <View key={invite.id} style={styles.manageRow}>
                  <View style={styles.managePrimary}>
                    <Text style={styles.manageTitle}>{invite.name || 'Invite token'}</Text>
                    <Text style={styles.manageMeta}>{invite.token}</Text>
                    <Text style={styles.manageMeta}>
                      {invite.used_at ? 'Used by another user' : 'Available'} • Expires {formatShortDate(invite.expires_at)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.manageIconButton}
                    onPress={() => {
                      setEditingInviteId(invite.id);
                      setInviteName(invite.name || 'Invite token');
                      const msLeft = new Date(invite.expires_at).getTime() - Date.now();
                      const days = Math.max(1, Math.ceil(msLeft / 86400000));
                      setInviteExpiresDays(String(days));
                    }}
                  >
                    <Text style={styles.manageIconText}>✎</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.manageIconButtonDanger}
                    onPress={() => {
                      Alert.alert('Remove token', 'Delete this invitation token?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => void removeInviteToken(invite.id) },
                      ]);
                    }}
                  >
                    <Text style={styles.manageIconText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Join with token</Text>
            <TextInput
              placeholder="Paste token"
              placeholderTextColor="#64748B"
              value={joinToken}
              onChangeText={setJoinToken}
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondary} onPress={() => setShowInvitationsModal(false)}>
                <Text style={styles.modalSecondaryText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimary} onPress={() => void joinByToken()} disabled={saving}>
                <Text style={styles.modalPrimaryText}>Join</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: '#060A14',
    alignItems: 'center',
  },
  surfaceFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: '#060A14',
  },
  surfaceFrameDesktop: {
    maxWidth: 1180,
  },
  surfaceFrameMobile: {
    maxWidth: 430,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#101A2A',
  },
  container: {
    flex: 1,
    backgroundColor: '#060A14',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#060A14',
  },
  loadingText: {
    marginTop: 10,
    color: '#9BB0C9',
    fontSize: 14,
  },
  headerRow: {
    paddingTop: Platform.OS === 'web' ? 14 : 48,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    backgroundColor: '#0E1A2B',
    borderColor: '#1F3A59',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  menuButtonText: {
    color: '#DCEBFF',
    fontSize: 13,
    fontWeight: '700',
  },
  greetingCard: {
    backgroundColor: '#0E1A2B',
    borderColor: '#1F3A59',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    width: 52,
    height: 52,
  },
  viewToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  viewToggleButton: {
    backgroundColor: '#0E1A2B',
    borderColor: '#2A4163',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  viewToggleButtonActive: {
    borderColor: '#53E3A6',
    backgroundColor: '#173129',
  },
  viewToggleText: {
    color: '#DCEBFF',
    fontSize: 12,
    fontWeight: '700',
  },
  greeting: {
    color: '#F2F6FF',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#8AA1BF',
    fontSize: 13,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    paddingTop: 16,
  },
  warningBanner: {
    backgroundColor: '#4A1F2A',
    borderColor: '#C7546C',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  warningBannerTitle: {
    color: '#FFE3EA',
    fontSize: 13,
    fontWeight: '800',
  },
  warningBannerText: {
    color: '#FFD4DE',
    fontSize: 12,
    marginTop: 4,
  },
  cardStrong: {
    backgroundColor: '#0E1726',
    borderColor: '#263C5D',
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  cardStrongLabel: {
    color: '#95ABCB',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardStrongValue: {
    marginTop: 8,
    color: '#B5FFDD',
    fontSize: 32,
    fontWeight: '800',
  },
  summaryRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryText: {
    color: '#8EA4C3',
    fontSize: 12,
    marginTop: 4,
  },
  accountOverviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  accountOverviewCard: {
    minWidth: '47%',
    flexGrow: 1,
    backgroundColor: '#101A2A',
    borderColor: '#263E5F',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  accountOverviewCardActive: {
    borderColor: '#53E3A6',
  },
  accountOverviewName: {
    color: '#DCE9FF',
    fontSize: 14,
    fontWeight: '700',
  },
  accountOverviewValue: {
    color: '#EAFBF3',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  accountOverviewMeta: {
    color: '#8EA4C3',
    fontSize: 12,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#E5EEFF',
    fontSize: 18,
    fontWeight: '700',
  },
  linkAction: {
    color: '#6ED8A5',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    color: '#7389A6',
    marginBottom: 14,
    fontSize: 13,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  categoryChip: {
    backgroundColor: '#121D2E',
    borderWidth: 1,
    borderColor: '#273A58',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  categoryChipText: {
    color: '#D8E6FF',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipType: {
    color: '#FCA5A5',
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  incomeType: {
    color: '#6ED8A5',
  },
  listCard: {
    backgroundColor: '#101A2A',
    borderColor: '#263E5F',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  spendRow: {
    marginBottom: 10,
  },
  spendLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  spendName: {
    color: '#DCE9FF',
    fontSize: 13,
    fontWeight: '600',
  },
  spendAmount: {
    color: '#9DB4D4',
    fontSize: 12,
  },
  spendBarTrack: {
    height: 8,
    backgroundColor: '#1E2F49',
    borderRadius: 999,
    overflow: 'hidden',
  },
  spendBarFill: {
    height: '100%',
    backgroundColor: '#FB7185',
    borderRadius: 999,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: '#1D2F47',
    borderBottomWidth: 1,
    paddingVertical: 10,
    gap: 12,
  },
  transactionTitle: {
    color: '#F0F6FF',
    fontWeight: '600',
    fontSize: 14,
  },
  transactionMeta: {
    color: '#7891B1',
    fontSize: 12,
    marginTop: 2,
  },
  transactionAmount: {
    fontWeight: '700',
    fontSize: 14,
  },
  positive: {
    color: '#6EE7A8',
  },
  negative: {
    color: '#FB7185',
  },
  pendingCard: {
    backgroundColor: '#121C2B',
    borderColor: '#35547D',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  pendingTitle: {
    color: '#DCE9FF',
    fontWeight: '700',
    marginBottom: 10,
  },
  pendingAccountName: {
    color: '#E9F1FF',
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: '#08111D',
    borderTopWidth: 1,
    borderTopColor: '#20334F',
  },
  bottomBarIncome: {
    flex: 1,
    backgroundColor: '#1A5B47',
    paddingVertical: 14,
    borderRadius: 14,
  },
  bottomBarTransfer: {
    flex: 1,
    backgroundColor: '#214264',
    paddingVertical: 14,
    borderRadius: 14,
  },
  bottomBarExpense: {
    flex: 1,
    backgroundColor: '#69273A',
    paddingVertical: 14,
    borderRadius: 14,
  },
  bottomBarIcon: {
    color: '#EAF2FF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.44)',
    justifyContent: 'flex-start',
  },
  menuOverlayTapArea: {
    ...StyleSheet.absoluteFillObject,
  },
  menuPanel: {
    position: 'absolute',
    left: 0,
    marginTop: 48,
    width: 360,
    maxWidth: '92%',
    maxHeight: '86%',
    backgroundColor: '#0D1625',
    borderColor: '#2A4163',
    borderWidth: 1,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    padding: 16,
    gap: 8,
  },
  menuTitle: {
    color: '#F0F7FF',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 8,
  },
  menuScrollContent: {
    paddingBottom: 12,
    gap: 8,
  },
  menuSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  menuSectionTitle: {
    color: '#8FA8C9',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  menuIconAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#173129',
    borderColor: '#2B5A4B',
    borderWidth: 1,
  },
  menuIconActionText: {
    color: '#B5FFDD',
    fontSize: 16,
    fontWeight: '800',
  },
  menuChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  menuChip: {
    backgroundColor: '#16283D',
    borderColor: '#2D486E',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  menuChipActive: {
    borderColor: '#53E3A6',
    backgroundColor: '#1D3A3C',
  },
  menuChipText: {
    color: '#EAF3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  menuChipGhost: {
    borderColor: '#37557F',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  menuChipGhostText: {
    color: '#6EC7FF',
    fontSize: 12,
    fontWeight: '700',
  },
  customRangeStack: {
    marginBottom: 8,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#142235',
    borderColor: '#1E3552',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  managePrimary: {
    flex: 1,
  },
  manageTitle: {
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '700',
  },
  manageMeta: {
    color: '#8FA8C9',
    fontSize: 11,
    marginTop: 3,
  },
  manageIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D304A',
  },
  manageIconButtonDanger: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5F2434',
  },
  manageIconText: {
    color: '#EAF3FF',
    fontSize: 14,
    fontWeight: '800',
  },
  managePill: {
    color: '#A6BCD9',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#1D304A',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  manageNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  managePrimaryBadge: {
    color: '#53E3A6',
    fontSize: 12,
    fontWeight: '800',
  },
  manageSmallButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D304A',
  },
  manageSmallButtonDisabled: {
    opacity: 0.25,
  },
  manageSmallButtonActive: {
    backgroundColor: '#1A3D2E',
  },
  manageSmallText: {
    color: '#EAF3FF',
    fontSize: 12,
    fontWeight: '800',
  },
  manageSmallTextActive: {
    color: '#53E3A6',
  },
  menuItem: {
    backgroundColor: '#142235',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuItemText: {
    color: '#D7E6FC',
    fontWeight: '600',
  },
  menuDanger: {
    marginTop: 6,
    backgroundColor: '#5F2434',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuDangerText: {
    color: '#FFE3E9',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: '#0F1A2B',
    borderColor: '#2A3F60',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    maxHeight: '94%',
  },
  entryModalCard: {
    maxWidth: 560,
    minHeight: '84%',
  },
  modalTitle: {
    color: '#F1F6FF',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 10,
  },
  modalLabel: {
    color: '#A3B9D8',
    marginBottom: 6,
    marginTop: 6,
    fontSize: 12,
  },
  modalMeta: {
    color: '#8FA8C9',
    marginBottom: 10,
    fontSize: 12,
  },
  input: {
    backgroundColor: '#111F32',
    borderColor: '#2E496F',
    borderWidth: 1,
    borderRadius: 10,
    color: '#EDF5FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  entryTopRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  entryDateInput: {
    flex: 1,
  },
  entryAccountBtn: {
    backgroundColor: '#16283D',
    borderColor: '#2D486E',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  entryAccountBtnText: {
    color: '#EAF3FF',
    fontWeight: '700',
    fontSize: 12,
  },
  entryTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  toggleButton: {
    flex: 1,
    backgroundColor: '#13253B',
    borderWidth: 1,
    borderColor: '#2C4669',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 9,
  },
  toggleButtonActive: {
    borderColor: '#53E3A6',
    backgroundColor: '#1D3A3C',
  },
  toggleButtonText: {
    color: '#EAF1FF',
    fontWeight: '700',
  },
  entryAmountInput: {
    backgroundColor: '#091426',
    borderColor: '#35527A',
    borderWidth: 1,
    borderRadius: 12,
    color: '#F1F6FF',
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  entryCurrencyText: {
    textAlign: 'center',
    color: '#8FA8C9',
    marginBottom: 8,
  },
  modalChipsRow: {
    gap: 8,
    paddingBottom: 10,
  },
  modalChip: {
    backgroundColor: '#16283D',
    borderColor: '#2D486E',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  modalChipActive: {
    borderColor: '#53E3A6',
  },
  modalChipText: {
    color: '#EAF3FF',
    fontSize: 12,
    fontWeight: '600',
  },
  numpadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  numpadKey: {
    width: '31%',
    backgroundColor: '#142235',
    borderColor: '#2D486E',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  numpadKeyText: {
    color: '#EAF3FF',
    fontSize: 20,
    fontWeight: '700',
  },
  tagCreateRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  tagInput: {
    flex: 1,
    marginBottom: 0,
  },
  smallAction: {
    backgroundColor: '#1B2A41',
    borderColor: '#37557F',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  smallActionText: {
    color: '#D8E8FF',
    fontSize: 12,
    fontWeight: '700',
  },
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  currencyOption: {
    backgroundColor: '#16283D',
    borderColor: '#2D486E',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  currencyOptionActive: {
    borderColor: '#53E3A6',
    backgroundColor: '#1D3A3C',
  },
  currencyOptionText: {
    color: '#EAF3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  toggleRowCompact: {
    flexDirection: 'row',
    gap: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  modalSecondary: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A5378',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modalSecondaryText: {
    color: '#BAD0EE',
    fontWeight: '700',
  },
  modalPrimary: {
    borderRadius: 10,
    backgroundColor: '#53E3A6',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modalPrimaryText: {
    color: '#082215',
    fontWeight: '800',
  },
  modalDanger: {
    borderRadius: 10,
    backgroundColor: '#5F2434',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modalDangerText: {
    color: '#FFE3E9',
    fontWeight: '800',
  },
  // Desktop two-column layout
  desktopTwoColRow: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'flex-start',
  },
  desktopColLeft: {
    flex: 1,
  },
  desktopColRight: {
    flex: 1,
  },
  // Spend row category active highlight
  spendRowActive: {
    backgroundColor: '#15293D',
    borderRadius: 8,
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },
  spendNameActive: {
    color: '#53E3A6',
  },
  spendBarFillActive: {
    backgroundColor: '#53E3A6',
  },
  // Filtered transactions header
  filterLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  filterLabelSub: {
    color: '#7391B0',
    fontSize: 13,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  // Avatar button
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#1F3A59',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0E1A2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#F2F6FF',
    fontSize: 18,
    fontWeight: '800',
  },
  // Collapsible card header
  cardCollapseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardCollapseHeaderRight: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  collapseChevron: {
    color: '#6ED8A5',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  // Interval pill
  intervalPillRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 2,
  },
  intervalPill: {
    backgroundColor: '#16283D',
    borderColor: '#2D486E',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  intervalPillText: {
    color: '#EAF3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  intervalPickerWrap: {
    marginTop: 8,
    marginBottom: 4,
  },
  // Section header left cluster
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapseTrigger: {
    paddingHorizontal: 2,
  },
  // Battery chart
  batteryWrap: {
    marginBottom: 18,
  },
  batteryTrack: {
    flexDirection: 'row',
    height: 36,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1E2F49',
  },
  batterySegmentSpent: {
    backgroundColor: '#FB7185',
    alignItems: 'center',
    justifyContent: 'center',
  },
  batterySegmentUnspent: {
    backgroundColor: '#1D5A40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  batterySegLabel: {
    color: '#F0FFF8',
    fontSize: 12,
    fontWeight: '700',
  },
  batteryLegend: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  batteryLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batteryLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  batteryLegendText: {
    color: '#8EA4C3',
    fontSize: 12,
  },
  // Account picker in entry modal
  entryAccountBtnActive: {
    borderColor: '#53E3A6',
    backgroundColor: '#1D3A3C',
  },
  // Bottom bar disabled state
  bottomBarDisabled: {
    opacity: 0.3,
  },
});
