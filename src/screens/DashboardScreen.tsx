import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Icon, { LUCIDE_ICON_NAMES } from '../components/Icon';
import {
  TransactionType,
  IntervalKey,
  AppAccount,
  AppCategory,
  AppTag,
  AppTransaction,
  AccountInvite,
  ManagedInvite,
  todayIso,
  parseAmount,
  isMissingTableError,
  isMissingColumnError,
} from '../types/dashboard';
import { styles } from './DashboardScreen.styles';
import { useDashboardData } from '../hooks/useDashboardData';
import { useFriends } from '../hooks/useFriends';
import CategoryModal from '../components/dashboard/CategoryModal';
import TagModal from '../components/dashboard/TagModal';
import TransferModal from '../components/dashboard/TransferModal';
import DatePickerModal from '../components/dashboard/DatePickerModal';
import IconPickerSheet from '../components/dashboard/IconPickerSheet';
import AccountPickerSheet from '../components/dashboard/AccountPickerSheet';
import EntryModal from '../components/dashboard/EntryModal';
import AccountModal from '../components/dashboard/AccountModal';
import InvitationsModal from '../components/dashboard/InvitationsModal';
import FriendsModal from '../components/dashboard/FriendsModal';

export default function DashboardScreen() {
  const { user, signOut } = useAuth();
  const { width, height } = useWindowDimensions();

  const data = useDashboardData(user);
  const {
    accounts,
    categories,
    tags,
    transactions,
    accountSettings,
    selectedAccountId, setSelectedAccountId,
    primaryAccountId,
    entryAccountId, setEntryAccountId,
    loading, reloading, animMultiplier,
    saving, setSaving,
    missingSchemaColumns,
    pendingSelectedAccountIdRef,
    hasLoadedOnceRef,
    schemaAlertSignatureRef,
    loadData, reloadDashboard,
    moveAccount, setPrimary,
  } = data;

  const {
    friends,
    pendingRequests,
    loading: friendsLoading,
    friendAccountMap,
    loadFriends,
    sendRequest: friendSendRequest,
    acceptRequest: friendAcceptRequest,
    rejectRequest: friendRejectRequest,
    cancelRequest: friendCancelRequest,
    removeFriend,
    blockUser,
    addFriendToAccount,
    removeFriendFromAccount,
  } = useFriends(user);

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
  const [menuIncomeCatExpanded, setMenuIncomeCatExpanded] = useState(false);
  const [menuExpenseCatExpanded, setMenuExpenseCatExpanded] = useState(false);
  const [menuTagsExpanded, setMenuTagsExpanded] = useState(false);
  const [menuAccountsEditMode, setMenuAccountsEditMode] = useState(false);
  const [menuIncomeCatEditMode, setMenuIncomeCatEditMode] = useState(false);
  const [menuExpenseCatEditMode, setMenuExpenseCatEditMode] = useState(false);
  const [menuTagsEditMode, setMenuTagsEditMode] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  const [entryType, setEntryType] = useState<TransactionType>('expense');
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

  const [categoryColor, setCategoryColor] = useState<string | null>(null);
  const [categoryIcon, setCategoryIcon] = useState<string | null>(null);
  const [categoryTagIds, setCategoryTagIds] = useState<string[]>([]);
  const [tagColor, setTagColor] = useState<string | null>(null);
  const [tagIcon, setTagIcon] = useState<string | null>(null);
  const [newAccountIcon, setNewAccountIcon] = useState<string | null>(null);
  const [accountTagIds, setAccountTagIds] = useState<string[]>([]);
  const [showIconPickerSheet, setShowIconPickerSheet] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<'category' | 'account' | 'tag' | null>(null);
  const [iconSearchQuery, setIconSearchQuery] = useState('');
  const [sidebarTxCount, setSidebarTxCount] = useState(12);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [entryHadInitialCategory, setEntryHadInitialCategory] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isCatPickerOpen, setIsCatPickerOpen] = useState(false);
  const [dragHighlightedCatId, setDragHighlightedCatId] = useState<string | null>(null);
  // Date picker navigation state
  const [dpYear, setDpYear] = useState(() => new Date().getFullYear());
  const [dpMonth, setDpMonth] = useState(() => new Date().getMonth());

  const [showAcctPickerSheet, setShowAcctPickerSheet] = useState(false);
  const [acctPickerSheetTarget, setAcctPickerSheetTarget] = useState<'entry' | 'invite' | null>(null);

  const [showIntervalPicker, setShowIntervalPicker] = useState(false);
  const [showEntryAccountPicker, setShowEntryAccountPicker] = useState(false);
  const [overviewCollapsed, setOverviewCollapsed] = useState(false);
  const [spendingCollapsed, setSpendingCollapsed] = useState(true);
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false);

  const noteInputRef = useRef<TextInput | null>(null);
  const mainScrollRef = useRef<ScrollView | null>(null);
  // Category picker swipe gesture
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catPickerAnim = useRef(new Animated.Value(0)).current;
  const isCatPickerOpenRef = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const acctPickerAnim = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const iconPickerAnim = useRef(new Animated.Value(0)).current;
  const catCellMeasurements = useRef<Record<string, { x: number; y: number; w: number; h: number }>>({});
  const catCellRefs = useRef<Record<string, View | null>>({});

  // PanResponder for the "Choose Category" button – swipe-to-select
  const chooseCatPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isCatPickerOpenRef.current = true;
        setIsCatPickerOpen(true);
        Animated.spring(catPickerAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 22,
          bounciness: 3,
        }).start();
      },
      onPanResponderMove: (evt) => {
        if (!isCatPickerOpenRef.current) return;
        const { pageX, pageY } = evt.nativeEvent;
        let hitId: string | null = null;
        for (const [id, m] of Object.entries(catCellMeasurements.current)) {
          if (pageX >= m.x && pageX <= m.x + m.w && pageY >= m.y && pageY <= m.y + m.h) {
            hitId = id;
            break;
          }
        }
        setDragHighlightedCatId(hitId);
      },
      onPanResponderRelease: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        let hitId: string | null = null;
        for (const [id, m] of Object.entries(catCellMeasurements.current)) {
          if (pageX >= m.x && pageX <= m.x + m.w && pageY >= m.y && pageY <= m.y + m.h) {
            hitId = id;
            break;
          }
        }
        if (hitId) {
          // Finger released over a category → select it immediately
          setEntryCategoryId(hitId);
          setDragHighlightedCatId(null);
          isCatPickerOpenRef.current = false;
          Animated.timing(catPickerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
            setIsCatPickerOpen(false);
          });
        } else {
          // Short tap or missed target → keep picker open for normal tap selection
          setDragHighlightedCatId(null);
        }
      },
      onPanResponderTerminate: () => {
        setDragHighlightedCatId(null);
      },
    }),
  ).current;

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
    if (reloading) return '—';
    const code = currencyOverride ?? selectedCurrency;
    const display = value * animMultiplier;
    if (code === 'HUF') {
      return `${new Intl.NumberFormat('en-US', { style: 'decimal', maximumFractionDigits: 0 }).format(display)} Ft`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(display);
  }, [animMultiplier, reloading, selectedCurrency]);

  const selectedCategories = useMemo(
    () => categories.filter((c) => c.account_id === selectedAccountId || c.account_id === null),
    [categories, selectedAccountId],
  );

  /** IDs of global "Transfer" categories — excluded from income/expense totals. */
  const transferCategoryIds = useMemo(
    () => categories.filter((c) => c.name === 'Transfer').map((c) => c.id),
    [categories],
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
    let transferIn = 0;
    let transferOut = 0;
    for (const tx of transactions) {
      if (tx.account_id !== accountId || !inInterval(tx.date)) continue;
      const n = Number(tx.amount) || 0;
      const isTransfer = tx.category_id != null && transferCategoryIds.includes(tx.category_id);
      if (isTransfer) {
        if (tx.type === 'income') transferIn += n;
        else transferOut += n;
      } else {
        if (tx.type === 'income') income += n;
        else expense += n;
      }
    }

    return {
      income,
      expense,
      transferIn,
      transferOut,
      openingBalance,
      net: openingBalance + income - expense + transferIn - transferOut,
    };
  }, [accountSettings, inInterval, interval, intervalBounds.start, transactions, transferCategoryIds]);

  const selectedSummary = useMemo(() => {
    if (!selectedAccountId) {
      return { income: 0, expense: 0, net: 0, openingBalance: 0, transferIn: 0, transferOut: 0 };
    }
    return buildAccountSummary(selectedAccountId);
  }, [buildAccountSummary, selectedAccountId]);

  const includedAccountIds = useMemo(
    () => accounts
      .filter((a) => accountSettings[a.id]?.included_in_balance ?? true)
      .map((a) => a.id),
    [accountSettings, accounts],
  );

  // All included-account transactions filtered by current interval (for overview mode)
  const filteredIncludedTxs = useMemo(
    () =>
      transactions
        .filter((t) => includedAccountIds.includes(t.account_id) && inInterval(t.date))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [transactions, includedAccountIds, inInterval],
  );

  const accountsById = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a])),
    [accounts],
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
          transferIn: summary.transferIn,
          transferOut: summary.transferOut,
          openingBalance: summary.openingBalance,
          balance: summary.net,
        };
      });
  }, [accounts, buildAccountSummary, includedAccountIds]);

  const totalIncludedSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let openingBalance = 0;
    let transferIn = 0;
    let transferOut = 0;

    for (const row of includedAccountSummaries) {
      income += row.income;
      expense += row.expense;
      openingBalance += row.openingBalance;
      transferIn += row.transferIn;
      transferOut += row.transferOut;
    }

    return {
      income,
      expense,
      transferIn,
      transferOut,
      openingBalance,
      net: openingBalance + income - expense + transferIn - transferOut,
    };
  }, [includedAccountSummaries]);

  const totalIncludedBalance = totalIncludedSummary.net;

  const overviewSummary = showAccountOverviewPicker ? totalIncludedSummary : selectedSummary;

  const categorySpendData = useMemo(() => {
    const sourceTxs = showAccountOverviewPicker ? filteredIncludedTxs : filteredSelectedTxs;
    const map: Record<string, number> = {};
    for (const tx of sourceTxs) {
      if (tx.type !== 'expense') continue;
      if (tx.category_id && transferCategoryIds.includes(tx.category_id)) continue;
      const key = tx.category_id ?? 'uncategorized';
      map[key] = (map[key] ?? 0) + (Number(tx.amount) || 0);
    }

    const lookupCats = showAccountOverviewPicker ? categories : selectedCategories;
    const rows = Object.entries(map)
      .map(([id, total]) => {
        const name = lookupCats.find((c) => c.id === id)?.name ??
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
  }, [showAccountOverviewPicker, filteredIncludedTxs, filteredSelectedTxs, categories, selectedCategories, transferCategoryIds]);

  const allIncludedCategorySpendData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of filteredIncludedTxs) {
      if (tx.type !== 'expense') continue;
      if (tx.category_id && transferCategoryIds.includes(tx.category_id)) continue;
      const key = tx.category_id ?? 'uncategorized';
      map[key] = (map[key] ?? 0) + (Number(tx.amount) || 0);
    }
    const rows = Object.entries(map)
      .map(([id, total]) => ({
        id,
        name: categories.find((c) => c.id === id)?.name ?? (id === 'uncategorized' ? 'Uncategorized' : 'Other'),
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 7);
    const max = rows[0]?.total ?? 0;
    return rows.map((r) => ({
      ...r,
      widthPercent: max > 0 ? Math.max(8, Math.round((r.total / max) * 100)) : 0,
    }));
  }, [filteredIncludedTxs, categories, transferCategoryIds]);

  const themeColor = useMemo(() => {
    if (overviewSummary.net <= 0) return '#ef4444';
    const ratio = overviewSummary.income > 0 ? overviewSummary.expense / overviewSummary.income : 0;
    if (ratio > 0.7) return '#f97316';
    if (ratio > 0.5) return '#eab308';
    return '#53E3A6';
  }, [overviewSummary]);

  const filteredIconNames = useMemo(() => {
    if (!iconSearchQuery.trim()) return LUCIDE_ICON_NAMES;
    const q = iconSearchQuery.toLowerCase();
    return LUCIDE_ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [iconSearchQuery]);

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

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    (document as any).querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [themeColor]);

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
    if (desktopView) setShowAccountOverviewPicker(false);
  }, [desktopView]);

  useEffect(() => {
    setVisibleTransactionsCount(12);
  }, [selectedAccountId, interval, customStart, customEnd, transactions.length, selectedCategoryFilter]);

  const handleDashboardScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = event.nativeEvent.contentOffset.y;
    setScrollY(currentY);

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

  const openDatePicker = useCallback(() => {
    const parts = entryDate.split('-');
    setDpYear(Number(parts[0]) || new Date().getFullYear());
    setDpMonth((Number(parts[1]) || new Date().getMonth() + 1) - 1);
    setShowDatePicker(true);
  }, [entryDate]);

  const openCatPicker = useCallback(() => {
    isCatPickerOpenRef.current = true;
    setIsCatPickerOpen(true);
    Animated.spring(catPickerAnim, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 3 }).start();
  }, [catPickerAnim]);

  const closeCatPicker = useCallback(() => {
    isCatPickerOpenRef.current = false;
    Animated.timing(catPickerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setIsCatPickerOpen(false);
      setDragHighlightedCatId(null);
    });
  }, [catPickerAnim]);

  const openAcctPickerSheet = useCallback((target: 'entry' | 'invite') => {
    setAcctPickerSheetTarget(target);
    setShowAcctPickerSheet(true);
    Animated.spring(acctPickerAnim, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 3 }).start();
  }, [acctPickerAnim]);

  const closeAcctPickerSheet = useCallback(() => {
    Animated.timing(acctPickerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowAcctPickerSheet(false);
      setAcctPickerSheetTarget(null);
    });
  }, [acctPickerAnim]);

  const openIconPickerSheet = useCallback((target: 'category' | 'account' | 'tag') => {
    setIconPickerTarget(target);
    setIconSearchQuery('');
    setShowIconPickerSheet(true);
    Animated.spring(iconPickerAnim, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 3 }).start();
  }, [iconPickerAnim]);

  const closeIconPickerSheet = useCallback(() => {
    Animated.timing(iconPickerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowIconPickerSheet(false);
      setIconPickerTarget(null);
    });
  }, [iconPickerAnim]);

  const shareInvite = useCallback(async (token: string) => {
    const message = `Join my Finduo shared account!\nToken: ${token}`;
    try {
      if (Platform.OS === 'web') {
        if ((navigator as any).share) {
          await (navigator as any).share({ title: 'Finduo Invite', text: message });
        } else {
          await navigator.clipboard.writeText(message);
          Alert.alert('Copied', 'Invite copied to clipboard.');
        }
      } else {
        await Share.share({ message });
      }
    } catch { /* user cancelled */ }
  }, []);

  const openEntryModal = useCallback((type: TransactionType, categoryId?: string | null) => {
    setEditingTransactionId(null);
    setEntryType(type);
    setEntryAmount('');
    setEntryDate(todayIso());
    setEntryCategoryId(categoryId ?? null);
    setEntryHadInitialCategory(!!categoryId);
    setEntryNote('');
    setEntryTagIds([]);
    setNewTagName('');
    setEntryAccountId(selectedAccountId);
    setShowEntryAccountPicker(false);
    isCatPickerOpenRef.current = false;
    setIsCatPickerOpen(false);
    catPickerAnim.setValue(0);
    setShowEntryModal(true);
  }, [catPickerAnim, selectedAccountId]);

  const openEditTransaction = useCallback((tx: AppTransaction) => {
    setEditingTransactionId(tx.id);
    setEntryType(tx.type);
    setEntryAmount(String(Math.abs(Number(tx.amount) || 0)));
    setEntryDate(tx.date);
    setEntryCategoryId(tx.category_id ?? null);
    setEntryHadInitialCategory(true); // editing always has context
    setEntryNote(tx.note ?? '');
    setEntryTagIds(tx.tag_ids);
    setEntryAccountId(tx.account_id);
    setShowEntryAccountPicker(false);
    isCatPickerOpenRef.current = false;
    setIsCatPickerOpen(false);
    catPickerAnim.setValue(0);
    setShowEntryModal(true);
  }, [catPickerAnim]);

  const openCreateAccount = useCallback(() => {
    setEditingAccountId(null);
    setNewAccountName('');
    setNewAccountCurrency(selectedAccount?.currency ?? 'USD');
    setSettingsIncluded(true);
    setSettingsCarryOver(true);
    setSettingsInitialBalance('0');
    setSettingsInitialDate(todayIso());
    setAccountTagIds([]);
    setNewAccountIcon(null);
    setShowAccountModal(true);
  }, [selectedAccount?.currency]);

  const openEditAccount = useCallback((account: AppAccount) => {
    const settings = accountSettings[account.id];
    setEditingAccountId(account.id);
    setNewAccountName(account.name);
    setNewAccountCurrency(account.currency);
    setNewAccountIcon(account.icon ?? null);
    setSettingsIncluded(settings?.included_in_balance ?? true);
    setSettingsCarryOver(settings?.carry_over_balance ?? true);
    setSettingsInitialBalance(String(settings?.initial_balance ?? 0));
    setSettingsInitialDate(settings?.initial_balance_date ?? account.created_at?.slice(0, 10) ?? todayIso());
    setAccountTagIds((account.tag_ids ?? []) as string[]);
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
          .update({ name: categoryName.trim(), type: categoryType, color: categoryColor, icon: categoryIcon, tag_ids: categoryTagIds })
          .eq('id', editingCategoryId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert({
          account_id: selectedAccountId,
          name: categoryName.trim(),
          type: categoryType,
          color: categoryColor,
          icon: categoryIcon,
          tag_ids: categoryTagIds,
        });
        if (error) throw error;
      }
      setCategoryColor(null);
      setCategoryIcon(null);
      setCategoryTagIds([]);
      setShowCategoryModal(false);
      await loadData();
    } catch (err) {
      Alert.alert('Save category failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [categoryColor, categoryIcon, categoryName, categoryTagIds, categoryType, editingCategoryId, loadData, selectedAccountId]);

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
    if (!newTagName.trim()) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({ account_id: entryAccountId ?? selectedAccountId, name: newTagName.trim() })
        .select('id,account_id,name,color')
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
  }, [entryAccountId, loadData, newTagName, selectedAccountId]);

  const openCreateTag = useCallback(() => {
    setEditingTagId(null);
    setTagName('');
    setTagColor(null);
    setTagIcon(null);
    setShowTagModal(true);
  }, []);

  const openEditTag = useCallback((tag: AppTag) => {
    setEditingTagId(tag.id);
    setTagName(tag.name);
    setTagColor(tag.color ?? null);
    setTagIcon(tag.icon ?? null);
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
          .update({ name: tagName.trim(), color: tagColor, icon: tagIcon })
          .eq('id', editingTagId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tags')
          .insert({ account_id: selectedAccountId, name: tagName.trim(), color: tagColor, icon: tagIcon });
        if (error) throw error;
      }

      setTagColor(null);
      setTagIcon(null);
      setShowTagModal(false);
      await loadData();
    } catch (err) {
      Alert.alert('Save tag failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [editingTagId, loadData, tagColor, tagIcon, tagName]);

  const deleteTag = useCallback(async (tagId: string) => {
    setSaving(true);
    try {
      const { error: relationError } = await supabase
        .from('transaction_tags')
        .delete()
        .eq('tag_id', tagId);
      if (relationError && !isMissingTableError(relationError)) throw relationError;

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
          .update({ name: newAccountName.trim(), currency: newAccountCurrency, tag_ids: accountTagIds, icon: newAccountIcon ?? null })
          .eq('id', editingAccountId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('accounts')
          .insert({ name: newAccountName.trim(), currency: newAccountCurrency, created_by: user.id, tag_ids: [], icon: newAccountIcon ?? null })
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
      setAccountTagIds([]);
      setShowAccountModal(false);
      await loadData();
    } catch (err) {
      Alert.alert('Save account failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [
    accountTagIds,
    editingAccountId,
    loadData,
    newAccountCurrency,
    newAccountIcon,
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
      const customNote = transferNote.trim();
      const sourceNote = customNote ? `${customNote} (→ ${toAccount.name})` : `Transfer → ${toAccount.name}`;
      const targetNote = customNote ? `${customNote} (← ${fromAccount.name})` : `Transfer ← ${fromAccount.name}`;

      // Find-or-create "Transfer" categories so transfers don't appear as uncategorized
      // Creates per-account categories if no global (account_id=null) one exists.
      const findOrCreateCat = async (type: 'expense' | 'income', accountId: string) => {
        const existing = await supabase
          .from('categories')
          .select('id')
          .eq('name', 'Transfer')
          .eq('type', type)
          .limit(1)
          .maybeSingle();
        if (existing.data?.id) return existing.data.id as string;
        const created = await supabase
          .from('categories')
          .insert({ account_id: accountId, name: 'Transfer', type })
          .select('id')
          .single();
        return (created.data?.id ?? null) as string | null;
      };

      const [transferExpenseCatId, transferIncomeCatId] = await Promise.all([
        findOrCreateCat('expense', transferFromId!),
        findOrCreateCat('income', transferToId!),
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
        void shareInvite(token);
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
  }, [editingInviteId, invitationAccountId, inviteExpiresDays, inviteName, loadManagedInvites, shareInvite, user]);

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
        {!desktopView ? (
          <Image
            source={require('../../assets/logo.png')}
            style={[styles.headerLogo, { marginBottom: 24 }]}
            resizeMode="contain"
          />
        ) : null}
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
                setMenuIncomeCatExpanded(false);
                setMenuExpenseCatExpanded(false);
                setMenuTagsExpanded(false);
                setMenuAccountsEditMode(false);
                setMenuIncomeCatEditMode(false);
                setMenuExpenseCatEditMode(false);
                setMenuTagsEditMode(false);
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
            {/* Logo: absolutely centred; only the image itself is the tap target */}
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <View style={styles.headerLogoCenter} pointerEvents="box-none">
                <TouchableOpacity
                  onPress={() => void reloadDashboard()}
                  activeOpacity={0.7}
                  accessibilityLabel="Reload dashboard"
                >
                  <Image
                    source={require('../../assets/logo.png')}
                    style={[styles.headerLogo, reloading && { opacity: 0.5 }]}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>
            {/* Spacer so avatar and toggle don't overlap the logo */}
            <View style={{ flex: 1 }} pointerEvents="none" />
            {isDesktopBrowser && (
              <TouchableOpacity
                style={styles.viewToggleButton}
                onPress={() => setViewModeOverride(desktopView ? 'mobile' : 'desktop')}
                accessibilityLabel={desktopView ? 'Switch to mobile view' : 'Switch to desktop view'}
              >
                <Icon
                  name={desktopView ? 'smartphone' : 'laptop'}
                  size={18}
                  color="#8FA8C9"
                />
              </TouchableOpacity>
            )}
          </View>

          <View style={desktopView && includedAccountSummaries.length > 1 ? styles.desktopBodyWrapper : { flex: 1 }}>
          <ScrollView
            ref={mainScrollRef}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
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

            <View style={styles.cardStrong}>
              <Pressable
                disabled={desktopView}
                onPress={() => {
                  setShowAccountOverviewPicker((prev) => !prev);
                  setSelectedCategoryFilter(null);
                }}
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
              </Pressable>
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
                  <Text style={styles.summaryText}>Opening: <Text style={overviewSummary.openingBalance >= 0 ? styles.positive : styles.negative}>{formatCurrency(overviewSummary.openingBalance)}</Text></Text>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryText, styles.positive]}>Income {formatCurrency(overviewSummary.income)}</Text>
                    <Text style={[styles.summaryText, styles.negative]}>Expenses {formatCurrency(overviewSummary.expense)}</Text>
                  </View>
                  {(overviewSummary.transferIn > 0 || overviewSummary.transferOut > 0) && (
                    <View style={styles.summaryRow}>
                      {overviewSummary.transferIn > 0 && (
                        <Text style={[styles.summaryText, { color: '#a855f7' }]}>Transfer in ↔ {formatCurrency(overviewSummary.transferIn)}</Text>
                      )}
                      {overviewSummary.transferOut > 0 && (
                        <Text style={[styles.summaryText, { color: '#a855f7' }]}>Transfer out ↔ {formatCurrency(overviewSummary.transferOut)}</Text>
                      )}
                    </View>
                  )}
                  <Text style={styles.summaryText}>Total Included Balance: <Text style={totalIncludedBalance >= 0 ? styles.positive : styles.negative}>{formatCurrency(totalIncludedBalance)}</Text></Text>
                  {!desktopView && includedAccountSummaries.length > 1 && (
                    <Text style={styles.summaryText}>
                      Tap to {showAccountOverviewPicker ? 'hide accounts' : 'change account'}
                    </Text>
                  )}
                </>
              )}
            </View>

            {!desktopView && includedAccountSummaries.length > 1 && showAccountOverviewPicker && (
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
                      {(item.transferIn > 0 || item.transferOut > 0) && (
                        <Text style={{ color: '#a855f7', fontSize: 11, marginTop: 1 }}>↔ {formatCurrency(item.transferIn + item.transferOut, item.account.currency)}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={[styles.cardStrong, { marginBottom: 18 }]}>
              <TouchableOpacity
                style={[styles.cardCollapseHeader, { marginBottom: spendingCollapsed ? 0 : 12 }]}
                onPress={() => setSpendingCollapsed((p) => !p)}
                activeOpacity={0.7}
              >
                <Text style={styles.cardStrongLabel}>SPENDING BY CATEGORY</Text>
                <View style={styles.cardCollapseHeaderRight}>
                  {selectedCategoryFilter && !spendingCollapsed && (
                    <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); setSelectedCategoryFilter(null); }}>
                      <Text style={styles.linkAction}>✕ Clear</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.collapseChevron}>{spendingCollapsed ? '▸' : '▾'}</Text>
                </View>
              </TouchableOpacity>
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

            {/* Desktop battery chart */}
            {desktopView && (() => {
              const totalAvailable = overviewSummary.openingBalance + overviewSummary.income;
              const spent = overviewSummary.expense;
              const transferred = overviewSummary.transferOut;
              const remaining = totalAvailable - spent - transferred;
              const spentPct = totalAvailable > 0 ? Math.min(100, Math.round((spent / totalAvailable) * 100)) : 0;
              const transferPct = totalAvailable > 0 ? Math.min(100 - spentPct, Math.round((transferred / totalAvailable) * 100)) : 0;
              const unspentPct = 100 - spentPct - transferPct;
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
                        {transferPct > 0 && (
                          <View style={[styles.batterySegmentTransfer, { flex: transferPct }]}>
                            {transferPct >= 12 && <Text style={styles.batterySegLabel}>{transferPct}%</Text>}
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
                      <View style={[styles.batteryLegendDot, { backgroundColor: '#f87171' }]} />
                      <Text style={styles.batteryLegendText}>Spent {formatCurrency(spent)} ({spentPct}%)</Text>
                    </View>
                    {transferred > 0 && (
                      <View style={styles.batteryLegendItem}>
                        <View style={[styles.batteryLegendDot, { backgroundColor: '#a855f7' }]} />
                        <Text style={styles.batteryLegendText}>Transferred {formatCurrency(transferred)} ({transferPct}%)</Text>
                      </View>
                    )}
                    <View style={styles.batteryLegendItem}>
                      <View style={[styles.batteryLegendDot, { backgroundColor: '#53E3A6' }]} />
                      <Text style={styles.batteryLegendText}>Remaining {formatCurrency(Math.max(0, remaining))} ({unspentPct}%)</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {!showAccountOverviewPicker && (
            <>
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
                setCategoryColor(null);
                setCategoryIcon(null);
                setCategoryTagIds([]);
                setShowCategoryModal(true);
              }}>
                <Icon name={"add_circle" as any} size={22} color="#6ED8A5" />
              </TouchableOpacity>
            </View>

            {(!desktopView || !categoriesCollapsed) && (
            <View style={styles.chipsWrap}>
              {sortedSelectedCategories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.categoryChip, c.color ? { borderColor: c.color } : undefined]}
                  onPress={() => openEntryModal(c.type, c.id)}
                  onLongPress={() => {
                    setEditingCategoryId(c.id);
                    setCategoryName(c.name);
                    setCategoryType(c.type);
                    setCategoryColor(c.color ?? null);
                    setCategoryIcon(c.icon ?? null);
                    setCategoryTagIds((c.tag_ids ?? []) as string[]);
                    setShowCategoryModal(true);
                  }}
                >
                  <View style={styles.categoryChipInner}>
                    {c.icon ? (
                      <Icon
                        name={c.icon as any}
                        size={14}
                        color={c.color ?? (c.type === 'income' ? '#6ED8A5' : '#FCA5A5')}
                        style={{ marginRight: 4 }}
                      />
                    ) : null}
                    <Text style={styles.categoryChipText}>{c.name}</Text>
                  </View>
                  <Text style={[styles.categoryChipType, c.type === 'income' && styles.incomeType]}>{c.type}</Text>
                </TouchableOpacity>
              ))}
            </View>
            )}
            </>
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
                <Text style={styles.sectionTitle}>
                  {showAccountOverviewPicker ? 'Included Transactions' : 'Recent Transactions'}
                </Text>
              )}
              <View style={styles.sectionHeaderActions}>
                {selectedCategoryFilter && (
                  <TouchableOpacity onPress={() => setSelectedCategoryFilter(null)}>
                    <Text style={styles.linkAction}>✕ All</Text>
                  </TouchableOpacity>
                )}
                {!showAccountOverviewPicker && (
                  <TouchableOpacity onPress={() => openEntryModal('expense', filterIsExpense ? selectedCategoryFilter : null)}>
                    <Icon name={"add_circle" as any} size={22} color="#6ED8A5" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.listCard}>
              {(() => {
                const txSource = showAccountOverviewPicker
                  ? filteredIncludedTxs.slice(0, visibleTransactionsCount)
                  : (selectedCategoryFilter ? categoryFilteredTxsVisible ?? [] : visibleSelectedTxs);
                return txSource.map((tx) => {
                  const isTransfer = tx.category_id != null && transferCategoryIds.includes(tx.category_id);
                  const acct = showAccountOverviewPicker ? accountsById[tx.account_id] : null;
                  return (
                    <TouchableOpacity key={tx.id} style={styles.transactionRow} onPress={() => openEditTransaction(tx)}>
                      <View style={{ flex: 1 }}>
                        <Text style={isTransfer ? [styles.transactionTitle, { color: '#a855f7' }] : styles.transactionTitle}>
                          {tx.note || (isTransfer ? 'Transfer' : 'Untitled transaction')}
                        </Text>
                        <Text style={styles.transactionMeta}>
                          {tx.date}{acct ? ` · ${acct.name}` : ''}
                        </Text>
                      </View>
                      <Text style={[
                        styles.transactionAmount,
                        isTransfer ? styles.transferAmount : (tx.type === 'income' ? styles.positive : styles.negative),
                      ]}>
                        {isTransfer ? '↔' : (tx.type === 'income' ? '+' : '-')}{formatCurrency(Number(tx.amount) || 0)}
                      </Text>
                    </TouchableOpacity>
                  );
                });
              })()}
              {(() => {
                const txLen = showAccountOverviewPicker
                  ? filteredIncludedTxs.slice(0, visibleTransactionsCount).length
                  : (selectedCategoryFilter ? (categoryFilteredTxsVisible?.length ?? 0) : visibleSelectedTxs.length);
                return txLen === 0 ? (
                  <Text style={styles.emptyText}>No transactions in this interval.</Text>
                ) : null;
              })()}
              {!showAccountOverviewPicker && hasMoreTransactions && !selectedCategoryFilter && (
                <Text style={styles.transactionMeta}>Scroll down to load more transactions</Text>
              )}
              {showAccountOverviewPicker && visibleTransactionsCount < filteredIncludedTxs.length && (
                <Text style={styles.transactionMeta}>Scroll down to load more transactions</Text>
              )}
            </View>

            {!!inviteToken && (
              <View style={styles.pendingCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.pendingTitle}>Latest invite token</Text>
                  <TouchableOpacity onPress={() => void shareInvite(inviteToken)}>
                    <Icon name="share" size={18} color="#8FA8C9" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.pendingAccountName}>{inviteToken}</Text>
              </View>
            )}
          </ScrollView>

          {/* ─── Desktop sidebar ─── */}
          {desktopView && includedAccountSummaries.length > 1 && (
            <ScrollView
              style={styles.desktopSidebar}
              contentContainerStyle={styles.desktopSidebarContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Total card */}
              <View style={[styles.cardStrong, { marginBottom: 12 }]}>
                <Text style={styles.cardStrongLabel}>ALL ACCOUNTS</Text>
                <Text style={[styles.cardStrongValue, totalIncludedSummary.net < 0 && styles.negative]}>
                  {formatCurrency(totalIncludedSummary.net)}
                </Text>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryText, styles.positive]}>In {formatCurrency(totalIncludedSummary.income)}</Text>
                  <Text style={[styles.summaryText, styles.negative]}>Out {formatCurrency(totalIncludedSummary.expense)}</Text>
                </View>
              </View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Included Accounts</Text>
              </View>
              <View style={styles.accountOverviewGrid}>
                {includedAccountSummaries.map((item) => (
                  <TouchableOpacity
                    key={item.account.id}
                    style={[
                      styles.accountOverviewCard,
                      selectedAccountId === item.account.id && styles.accountOverviewCardActive,
                    ]}
                    onPress={() => setSelectedAccountId(item.account.id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {item.account.icon && <Icon name={item.account.icon} size={16} color="#8FA8C9" />}
                      <Text style={styles.accountOverviewName}>{item.account.name}</Text>
                    </View>
                    <Text style={[styles.accountOverviewValue, item.balance < 0 && styles.negative]}>
                      {formatCurrency(item.balance, item.account.currency)}
                    </Text>
                    <Text style={styles.accountOverviewMetaIncome}>In {formatCurrency(item.income, item.account.currency)}</Text>
                    <Text style={styles.accountOverviewMetaExpense}>Out {formatCurrency(item.expense, item.account.currency)}</Text>
                    {(item.transferIn > 0 || item.transferOut > 0) && (
                      <Text style={{ color: '#a855f7', fontSize: 11, marginTop: 1 }}>↔ {formatCurrency(item.transferIn + item.transferOut, item.account.currency)}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.cardStrong, { marginTop: 12 }]}>
                <Text style={[styles.cardStrongLabel, { marginBottom: 12 }]}>SPENDING (ALL ACCOUNTS)</Text>
                {allIncludedCategorySpendData.length === 0 ? (
                  <Text style={styles.emptyText}>No expense data.</Text>
                ) : (
                  allIncludedCategorySpendData.map((row) => (
                    <View key={row.id} style={styles.spendRow}>
                      <View style={styles.spendLabelRow}>
                        <Text style={styles.spendName}>{row.name}</Text>
                        <Text style={styles.spendAmount}>{formatCurrency(row.total)}</Text>
                      </View>
                      <View style={styles.spendBarTrack}>
                        <View style={[styles.spendBarFill, { width: `${row.widthPercent}%` as any }]} />
                      </View>
                    </View>
                  ))
                )}
              </View>
              <View style={[styles.sectionHeader, { marginTop: 12 }]}>
                <Text style={styles.sectionTitle}>Included Transactions</Text>
              </View>
              <View style={styles.listCard}>
                {filteredIncludedTxs.slice(0, sidebarTxCount).map((tx) => {
                  const isSidebarTransfer = tx.category_id != null && transferCategoryIds.includes(tx.category_id);
                  return (
                  <TouchableOpacity
                    key={tx.id}
                    style={styles.sidebarTxRow}
                    onPress={() => openEditTransaction(tx)}
                  >
                    <Text style={isSidebarTransfer ? [styles.sidebarTxNote, { color: '#a855f7' }] : styles.sidebarTxNote} numberOfLines={1}>{tx.note || (isSidebarTransfer ? 'Transfer' : 'Untitled')}</Text>
                    <Text style={[styles.sidebarTxAmount, isSidebarTransfer ? styles.transferAmount : (tx.type === 'income' ? styles.positive : styles.negative)]}>
                      {isSidebarTransfer ? '↔' : (tx.type === 'income' ? '+' : '-')}{formatCurrency(Math.abs(Number(tx.amount)), accountsById[tx.account_id]?.currency)}
                    </Text>
                  </TouchableOpacity>
                  );
                })}
                {filteredIncludedTxs.length > sidebarTxCount && (
                  <TouchableOpacity onPress={() => setSidebarTxCount((c) => c + 12)} style={{ paddingVertical: 8 }}>
                    <Text style={styles.linkAction}>Load more</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          )}
          </View>{/* desktopBodyWrapper */}

          {scrollY > 320 && (
            <TouchableOpacity
              style={styles.scrollTopFab}
              onPress={() => mainScrollRef.current?.scrollTo({ y: 0, animated: true })}
              accessibilityLabel="Scroll to top"
            >
              <Icon name="arrow_up" size={22} color="#060A14" />
            </TouchableOpacity>
          )}

          {!showAccountOverviewPicker && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.bottomBarIncome, filterIsExpense && styles.bottomBarDisabled]}
              onPress={() => !filterIsExpense && openEntryModal('income', null)}
              accessibilityLabel="Add income"
            >
              <Icon name="add" size={28} color="#EAF2FF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bottomBarTransfer, filterIsExpense && styles.bottomBarDisabled]}
              onPress={() => !filterIsExpense && openTransfer()}
              accessibilityLabel="Transfer between accounts"
            >
              <Icon name={"swap_horiz" as any} size={28} color="#EAF2FF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomBarExpense}
              onPress={() => openEntryModal('expense', filterIsExpense ? selectedCategoryFilter : null)}
              accessibilityLabel="Add expense"
            >
              <Icon name="remove" size={28} color="#EAF2FF" />
            </TouchableOpacity>
          </View>
          )}
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
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {menuAccountsExpanded && (
                    <TouchableOpacity style={[styles.menuIconAction, menuAccountsEditMode && { backgroundColor: '#2C4669' }]} onPress={() => setMenuAccountsEditMode((p) => !p)}>
                      <Text style={styles.manageIconText}>✎</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.menuIconAction} onPress={() => {
                    setMenuOpen(false);
                    openCreateAccount();
                  }}>
                    <Text style={styles.menuIconActionText}>＋</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {menuAccountsExpanded && accounts.map((account, accountIdx) => {
                const isOwned = account.created_by === user?.id;
                const isPrimary = account.id === primaryAccountId;
                return (
                  <View key={account.id} style={styles.manageRow}>
                    {!menuAccountsEditMode && account.icon && (
                      <Icon name={account.icon as any} size={36} color="#8FA8C9" />
                    )}
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

                    {menuAccountsEditMode && (
                      <>
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
                      </>
                    )}
                  </View>
                );
              })}

              {/* ── Income Categories ── */}
              <View style={styles.menuSectionHeader}>
                <TouchableOpacity onPress={() => setMenuIncomeCatExpanded((prev) => !prev)}>
                  <Text style={[styles.menuSectionTitle, { color: '#4ade80' }]}>Income {menuIncomeCatExpanded ? '▾' : '▸'}</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {menuIncomeCatExpanded && (
                    <TouchableOpacity style={[styles.menuIconAction, menuIncomeCatEditMode && { backgroundColor: '#2C4669' }]} onPress={() => setMenuIncomeCatEditMode((p) => !p)}>
                      <Text style={styles.manageIconText}>✎</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.menuIconAction} onPress={() => {
                    setMenuOpen(false);
                    setEditingCategoryId(null);
                    setCategoryName('');
                    setCategoryType('income');
                    setCategoryColor(null);
                    setCategoryIcon(null);
                    setCategoryTagIds([]);
                    setShowCategoryModal(true);
                  }}>
                    <Text style={styles.menuIconActionText}>＋</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {menuIncomeCatExpanded && selectedCategories.filter((c) => c.type === 'income').map((category) => {
                const catColor = category.color ?? '#4ade80';
                return (
                  <View key={category.id} style={styles.manageRow}>
                    <TouchableOpacity style={styles.managePrimary} onPress={() => { setMenuOpen(false); openEntryModal(category.type, category.id); }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {category.icon ? <Icon name={category.icon as any} size={16} color={catColor} /> : null}
                        <Text style={[styles.manageTitle, { color: catColor }]}>{category.name}</Text>
                      </View>
                    </TouchableOpacity>
                    {menuIncomeCatEditMode && (
                      <>
                        <TouchableOpacity style={styles.manageIconButton} onPress={() => {
                          setMenuOpen(false);
                          setEditingCategoryId(category.id);
                          setCategoryName(category.name);
                          setCategoryType(category.type);
                          setCategoryColor(category.color ?? null);
                          setCategoryIcon(category.icon ?? null);
                          setCategoryTagIds((category.tag_ids ?? []) as string[]);
                          setShowCategoryModal(true);
                        }}>
                          <Text style={styles.manageIconText}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.manageIconButtonDanger} onPress={() => {
                          Alert.alert('Remove category', `Remove ${category.name}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => { setMenuOpen(false); void deleteCategory(category.id); } },
                          ]);
                        }}>
                          <Text style={styles.manageIconText}>✕</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                );
              })}

              {/* ── Expense Categories ── */}
              <View style={styles.menuSectionHeader}>
                <TouchableOpacity onPress={() => setMenuExpenseCatExpanded((prev) => !prev)}>
                  <Text style={[styles.menuSectionTitle, { color: '#f87171' }]}>Expense {menuExpenseCatExpanded ? '▾' : '▸'}</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {menuExpenseCatExpanded && (
                    <TouchableOpacity style={[styles.menuIconAction, menuExpenseCatEditMode && { backgroundColor: '#2C4669' }]} onPress={() => setMenuExpenseCatEditMode((p) => !p)}>
                      <Text style={styles.manageIconText}>✎</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.menuIconAction} onPress={() => {
                    setMenuOpen(false);
                    setEditingCategoryId(null);
                    setCategoryName('');
                    setCategoryType('expense');
                    setCategoryColor(null);
                    setCategoryIcon(null);
                    setCategoryTagIds([]);
                    setShowCategoryModal(true);
                  }}>
                    <Text style={styles.menuIconActionText}>＋</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {menuExpenseCatExpanded && selectedCategories.filter((c) => c.type === 'expense').map((category) => {
                const catColor = category.color ?? '#f87171';
                return (
                  <View key={category.id} style={styles.manageRow}>
                    <TouchableOpacity style={styles.managePrimary} onPress={() => { setMenuOpen(false); openEntryModal(category.type, category.id); }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {category.icon ? <Icon name={category.icon as any} size={16} color={catColor} /> : null}
                        <Text style={[styles.manageTitle, { color: catColor }]}>{category.name}</Text>
                      </View>
                    </TouchableOpacity>
                    {menuExpenseCatEditMode && (
                      <>
                        <TouchableOpacity style={styles.manageIconButton} onPress={() => {
                          setMenuOpen(false);
                          setEditingCategoryId(category.id);
                          setCategoryName(category.name);
                          setCategoryType(category.type);
                          setCategoryColor(category.color ?? null);
                          setCategoryIcon(category.icon ?? null);
                          setCategoryTagIds((category.tag_ids ?? []) as string[]);
                          setShowCategoryModal(true);
                        }}>
                          <Text style={styles.manageIconText}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.manageIconButtonDanger} onPress={() => {
                          Alert.alert('Remove category', `Remove ${category.name}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => { setMenuOpen(false); void deleteCategory(category.id); } },
                          ]);
                        }}>
                          <Text style={styles.manageIconText}>✕</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                );
              })}

              <View style={styles.menuSectionHeader}>
                <TouchableOpacity onPress={() => setMenuTagsExpanded((prev) => !prev)}>
                  <Text style={styles.menuSectionTitle}>Tags {menuTagsExpanded ? '▾' : '▸'}</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {menuTagsExpanded && (
                    <TouchableOpacity style={[styles.menuIconAction, menuTagsEditMode && { backgroundColor: '#2C4669' }]} onPress={() => setMenuTagsEditMode((p) => !p)}>
                      <Text style={styles.manageIconText}>✎</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.menuIconAction} onPress={() => {
                    setMenuOpen(false);
                    openCreateTag();
                  }}>
                    <Text style={styles.menuIconActionText}>＋</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {menuTagsExpanded && selectedTags.map((tag) => (
                <View key={tag.id} style={styles.manageRow}>
                  <View style={styles.managePrimary}>
                    <Text style={styles.manageTitle}>#{tag.name}</Text>
                    <Text style={styles.manageMeta}>{accounts.find((a) => a.id === tag.account_id)?.name ?? 'Global'}</Text>
                  </View>
                  {menuTagsEditMode && (
                    <>
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
                    </>
                  )}
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

              <TouchableOpacity style={styles.menuItem} onPress={() => {
                setMenuOpen(false);
                setShowFriendsModal(true);
              }}>
                <Text style={styles.menuItemText}>Friends</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => {
                setMenuOpen(false);
                if (Platform.OS === 'web') {
                  (window as any).location.reload();
                } else {
                  void reloadDashboard();
                }
              }}>
                <Text style={styles.menuItemText}>Reload app</Text>
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

      <EntryModal
        visible={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        desktopView={desktopView}
        editingTransactionId={editingTransactionId}
        entryType={entryType}
        setEntryType={setEntryType}
        entryAmount={entryAmount}
        setEntryAmount={setEntryAmount}
        entryDate={entryDate}
        entryNote={entryNote}
        setEntryNote={setEntryNote}
        entryCategoryId={entryCategoryId}
        setEntryCategoryId={setEntryCategoryId}
        entryTagIds={entryTagIds}
        toggleTag={toggleTag}
        entryHadInitialCategory={entryHadInitialCategory}
        noteFieldFocused={noteFieldFocused}
        setNoteFieldFocused={setNoteFieldFocused}
        showEntryAccountPicker={showEntryAccountPicker}
        setShowEntryAccountPicker={setShowEntryAccountPicker}
        accounts={accounts}
        entryAccountId={entryAccountId}
        setEntryAccountId={setEntryAccountId}
        entryAccount={entryAccount}
        selectedCurrency={selectedCurrency}
        entryCategories={entryCategories}
        entryTags={entryTags}
        recentCategoryAmounts={recentCategoryAmounts}
        noteSuggestions={noteSuggestions}
        newTagName={newTagName}
        setNewTagName={setNewTagName}
        createTag={createTag}
        appendNumpad={appendNumpad}
        saveEntry={saveEntry}
        formatCurrency={formatCurrency}
        openDatePicker={openDatePicker}
        openAcctPickerSheet={openAcctPickerSheet}
        chooseCatPanResponder={chooseCatPanResponder}
        catPickerAnim={catPickerAnim}
        isCatPickerOpen={isCatPickerOpen}
        dragHighlightedCatId={dragHighlightedCatId}
        openCatPicker={openCatPicker}
        closeCatPicker={closeCatPicker}
        catCellRefs={catCellRefs}
        catCellMeasurements={catCellMeasurements}
        height={height}
        noteInputRef={noteInputRef}
        saving={saving}
      />

      <CategoryModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        editingCategoryId={editingCategoryId}
        categoryName={categoryName}
        setCategoryName={setCategoryName}
        categoryType={categoryType}
        setCategoryType={setCategoryType}
        categoryColor={categoryColor}
        setCategoryColor={setCategoryColor}
        categoryIcon={categoryIcon}
        setCategoryIcon={setCategoryIcon}
        categoryTagIds={categoryTagIds}
        setCategoryTagIds={setCategoryTagIds}
        tags={tags}
        onSave={() => void saveCategory()}
        onDelete={deleteCategory}
        openIconPickerSheet={openIconPickerSheet}
        saving={saving}
      />

      <AccountModal
        visible={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        editingAccountId={editingAccountId}
        editingAccount={editingAccount}
        user={user}
        newAccountName={newAccountName}
        setNewAccountName={setNewAccountName}
        newAccountIcon={newAccountIcon}
        setNewAccountIcon={setNewAccountIcon}
        newAccountCurrency={newAccountCurrency}
        setNewAccountCurrency={setNewAccountCurrency}
        settingsIncluded={settingsIncluded}
        setSettingsIncluded={setSettingsIncluded}
        settingsCarryOver={settingsCarryOver}
        setSettingsCarryOver={setSettingsCarryOver}
        settingsInitialBalance={settingsInitialBalance}
        setSettingsInitialBalance={setSettingsInitialBalance}
        settingsInitialDate={settingsInitialDate}
        setSettingsInitialDate={setSettingsInitialDate}
        accountTagIds={accountTagIds}
        setAccountTagIds={setAccountTagIds}
        tags={tags}
        onSave={() => void saveAccount()}
        onDelete={deleteAccount}
        openIconPickerSheet={openIconPickerSheet}
        saving={saving}
      />

      <TagModal
        visible={showTagModal}
        onClose={() => setShowTagModal(false)}
        editingTagId={editingTagId}
        tagName={tagName}
        setTagName={setTagName}
        tagColor={tagColor}
        setTagColor={setTagColor}
        tagIcon={tagIcon}
        setTagIcon={setTagIcon}
        onSave={() => void saveTag()}
        onDelete={deleteTag}
        openIconPickerSheet={openIconPickerSheet}
        saving={saving}
      />

      <TransferModal
        visible={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        accounts={accounts}
        transferFromId={transferFromId}
        setTransferFromId={setTransferFromId}
        transferToId={transferToId}
        setTransferToId={setTransferToId}
        transferSourceAmount={transferSourceAmount}
        setTransferSourceAmount={setTransferSourceAmount}
        transferRate={transferRate}
        setTransferRate={setTransferRate}
        transferTargetAmount={transferTargetAmount}
        setTransferTargetAmount={setTransferTargetAmount}
        transferDate={transferDate}
        setTransferDate={setTransferDate}
        transferNote={transferNote}
        setTransferNote={setTransferNote}
        onSave={() => void saveTransfer()}
        saving={saving}
      />

      <InvitationsModal
        visible={showInvitationsModal}
        onClose={() => setShowInvitationsModal(false)}
        desktopView={desktopView}
        accounts={accounts}
        invitationAccountId={invitationAccountId}
        setInvitationAccountId={setInvitationAccountId}
        loadManagedInvites={loadManagedInvites}
        openAcctPickerSheet={openAcctPickerSheet}
        inviteName={inviteName}
        setInviteName={setInviteName}
        inviteExpiresDays={inviteExpiresDays}
        setInviteExpiresDays={setInviteExpiresDays}
        editingInviteId={editingInviteId}
        setEditingInviteId={setEditingInviteId}
        managedInvites={managedInvites}
        joinToken={joinToken}
        setJoinToken={setJoinToken}
        saveInviteToken={saveInviteToken}
        removeInviteToken={removeInviteToken}
        joinByToken={joinByToken}
        shareInvite={shareInvite}
        saving={saving}
      />

      <FriendsModal
        visible={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
        friends={friends}
        pendingRequests={pendingRequests}
        loading={friendsLoading}
        onOpen={loadFriends}
        sendRequest={friendSendRequest}
        acceptRequest={friendAcceptRequest}
        rejectRequest={friendRejectRequest}
        cancelRequest={friendCancelRequest}
        removeFriend={removeFriend}
        blockUser={blockUser}
        ownedAccounts={accounts.filter((a) => a.created_by === user?.id)}
        friendAccountMap={friendAccountMap}
        addFriendToAccount={addFriendToAccount}
        removeFriendFromAccount={removeFriendFromAccount}
        reloadDashboard={reloadDashboard}
      />

      {/* ─── Date Picker Modal ─── */}
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        entryDate={entryDate}
        setEntryDate={setEntryDate}
        dpYear={dpYear}
        setDpYear={setDpYear}
        dpMonth={dpMonth}
        setDpMonth={setDpMonth}
      />
      <AccountPickerSheet
        visible={showAcctPickerSheet}
        onClose={closeAcctPickerSheet}
        acctPickerAnim={acctPickerAnim}
        height={height}
        accounts={accounts}
        acctPickerSheetTarget={acctPickerSheetTarget}
        entryAccountId={entryAccountId}
        setEntryAccountId={setEntryAccountId}
        invitationAccountId={invitationAccountId}
        setInvitationAccountId={setInvitationAccountId}
        loadManagedInvites={loadManagedInvites}
      />

      <IconPickerSheet
        visible={showIconPickerSheet}
        onClose={closeIconPickerSheet}
        iconPickerAnim={iconPickerAnim}
        height={height}
        iconSearchQuery={iconSearchQuery}
        setIconSearchQuery={setIconSearchQuery}
        filteredIconNames={filteredIconNames}
        iconPickerTarget={iconPickerTarget}
        categoryIcon={categoryIcon}
        setCategoryIcon={setCategoryIcon}
        newAccountIcon={newAccountIcon}
        setNewAccountIcon={setNewAccountIcon}
        tagIcon={tagIcon}
        setTagIcon={setTagIcon}
      />

    </View>
  );
}

