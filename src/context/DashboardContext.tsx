import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { User } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { logAPI } from '../lib/devtools';
import Icon, { LUCIDE_ICON_NAMES } from '../components/Icon';
import {
  TransactionType,
  IntervalKey,
  AppAccount,
  AppCategory,
  AppTag,
  AppTransaction,
  AccountSetting,
  AccountInvite,
  ManagedInvite,
  todayIso,
  parseAmount,
  isMissingTableError,
  isMissingColumnError,
} from '../types/dashboard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useFriends } from '../hooks/useFriends';
import { useDebts } from '../hooks/useDebts';
import { useQueryClient } from '@tanstack/react-query';
import { useAccountsQuery, accountsQueryKey } from '../hooks/useAccountsQuery';
import type { AccountsQueryData } from '../hooks/useAccountsQuery';
import { useTransactionsQuery, transactionsQueryKey, sortedKey } from '../hooks/useTransactionsQuery';
import DatePickerModal from '../components/dashboard/DatePickerModal';
import AccountPickerSheet from '../components/dashboard/AccountPickerSheet';
import IconPickerSheet from '../components/dashboard/IconPickerSheet';
import { useCategoriesQuery, categoriesQueryKey } from '../hooks/useCategoriesQuery';
import type { CategoriesQueryData } from '../hooks/useCategoriesQuery';
import { useTagsQuery, tagsQueryKey } from '../hooks/useTagsQuery';
import { useAccountSettingsQuery, accountSettingsQueryKey } from '../hooks/useAccountSettingsQuery';
import type { ResolvedFriend, ResolvedRequest } from '../types/friends';
import type { AppDebt } from '../types/pools';

// ─── Derived types ──────────────────────────────────────────────────────────

export type AccountSummary = {
  income: number;
  expense: number;
  transferIn: number;
  transferOut: number;
  openingBalance: number;
  net: number;
};

export type IncludedAccountSummaryItem = {
  account: AppAccount;
  income: number;
  expense: number;
  transferIn: number;
  transferOut: number;
  openingBalance: number;
  balance: number;
};

export type CategorySpendRow = {
  id: string;
  name: string;
  total: number;
  color: string | null;
  widthPercent: number;
};

// ─── Context value type ──────────────────────────────────────────────────────

export type DashboardContextValue = {
  // Auth
  user: User | null;
  avatarUrl: string | null;
  signOut: () => void;
  // Navigation
  navigation: ReturnType<typeof useNavigation<any>>;
  // Section routing
  activeSection: 'pools' | 'lending' | 'settlements' | 'contacts' | null;
  setActiveSection: (section: 'pools' | 'lending' | 'settlements' | 'contacts' | null) => void;
  // Dimensions
  width: number;
  height: number;
  // Layout flags
  isDesktopBrowser: boolean;
  desktopView: boolean;
  framedMobileView: boolean;
  // ── useDashboardData ──
  accounts: AppAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<AppAccount[]>>;
  categories: AppCategory[];
  setCategories: React.Dispatch<React.SetStateAction<AppCategory[]>>;
  tags: AppTag[];
  setTags: React.Dispatch<React.SetStateAction<AppTag[]>>;
  transactions: AppTransaction[];
  setTransactions: React.Dispatch<React.SetStateAction<AppTransaction[]>>;
  accountSettings: Record<string, AccountSetting>;
  setAccountSettings: React.Dispatch<React.SetStateAction<Record<string, AccountSetting>>>;
  hiddenCategoryIds: Set<string>;
  setHiddenCategoryIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedAccountId: string | null;
  setSelectedAccountId: React.Dispatch<React.SetStateAction<string | null>>;
  primaryAccountId: string | null;
  entryAccountId: string | null;
  setEntryAccountId: React.Dispatch<React.SetStateAction<string | null>>;
  excludedAccountIds: string[];
  loading: boolean;
  reloading: boolean;
  reloadKey: number;
  animMultiplier: number;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  missingSchemaColumns: string[];
  pendingSelectedAccountIdRef: React.MutableRefObject<string | null>;
  schemaAlertSignatureRef: React.MutableRefObject<string>;
  reloadDashboard: () => Promise<void>;
  moveAccount: (idx: number, direction: 'up' | 'down') => void;
  setPrimary: (id: string) => void;
  toggleAccountExclusion: (id: string) => void;
  // ── useFriends ──
  friends: ResolvedFriend[];
  pendingRequests: ResolvedRequest[];
  friendsLoading: boolean;
  friendAccountMap: Record<string, string[]>;
  loadFriends: () => Promise<void>;
  friendSendRequest: (email: string) => Promise<boolean>;
  friendAcceptRequest: (id: string) => Promise<void>;
  friendRejectRequest: (id: string) => Promise<void>;
  friendCancelRequest: (id: string) => Promise<void>;
  removeFriend: (id: string) => Promise<void>;
  blockUser: (id: string) => Promise<void>;
  addFriendToAccount: (friendUserId: string, accountId: string) => Promise<boolean>;
  removeFriendFromAccount: (friendUserId: string, accountId: string) => Promise<boolean>;
  // ── useDebts ──
  debts: AppDebt[];
  pendingDebtCount: number;
  // ── UI state ──
  interval: IntervalKey;
  setInterval: React.Dispatch<React.SetStateAction<IntervalKey>>;
  customStart: string;
  setCustomStart: React.Dispatch<React.SetStateAction<string>>;
  customEnd: string;
  setCustomEnd: React.Dispatch<React.SetStateAction<string>>;
  timeCursorOffset: number;
  setTimeCursorOffset: React.Dispatch<React.SetStateAction<number>>;
  intervalVisibility: Record<IntervalKey, boolean>;
  setIntervalVisibility: React.Dispatch<React.SetStateAction<Record<IntervalKey, boolean>>>;
  intervalLabel: string;
  navigateInterval: (dir: 'prev' | 'next') => void;
  viewModeOverride: 'desktop' | 'mobile' | null;
  setViewModeOverride: React.Dispatch<React.SetStateAction<'desktop' | 'mobile' | null>>;
  showAccountOverviewPicker: boolean;
  setShowAccountOverviewPicker: React.Dispatch<React.SetStateAction<boolean>>;
  visibleTransactionsCount: number;
  setVisibleTransactionsCount: React.Dispatch<React.SetStateAction<number>>;
  menuAccountsExpanded: boolean;
  setMenuAccountsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  menuIncomeCatExpanded: boolean;
  setMenuIncomeCatExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  menuExpenseCatExpanded: boolean;
  setMenuExpenseCatExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  menuTagsExpanded: boolean;
  setMenuTagsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  menuAccountsEditMode: boolean;
  setMenuAccountsEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  menuIncomeCatEditMode: boolean;
  setMenuIncomeCatEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  menuExpenseCatEditMode: boolean;
  setMenuExpenseCatEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  menuTagsEditMode: boolean;
  setMenuTagsEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  selectedCategoryFilter: string | null;
  setSelectedCategoryFilter: React.Dispatch<React.SetStateAction<string | null>>;
  selectedTagFilter: string | null;
  setSelectedTagFilter: React.Dispatch<React.SetStateAction<string | null>>;
  showOnlyTransfers: boolean;
  setShowOnlyTransfers: React.Dispatch<React.SetStateAction<boolean>>;
  // ── Entry form state ──
  entryType: TransactionType;
  setEntryType: React.Dispatch<React.SetStateAction<TransactionType>>;
  entryAmount: string;
  setEntryAmount: React.Dispatch<React.SetStateAction<string>>;
  entryDate: string;
  setEntryDate: React.Dispatch<React.SetStateAction<string>>;
  entryCategoryId: string | null;
  setEntryCategoryId: React.Dispatch<React.SetStateAction<string | null>>;
  entryNote: string;
  setEntryNote: React.Dispatch<React.SetStateAction<string>>;
  entryTagIds: string[];
  setEntryTagIds: React.Dispatch<React.SetStateAction<string[]>>;
  newTagName: string;
  setNewTagName: React.Dispatch<React.SetStateAction<string>>;
  noteFieldFocused: boolean;
  setNoteFieldFocused: React.Dispatch<React.SetStateAction<boolean>>;
  // ── Category form state ──
  categoryName: string;
  setCategoryName: React.Dispatch<React.SetStateAction<string>>;
  categoryType: TransactionType;
  setCategoryType: React.Dispatch<React.SetStateAction<TransactionType>>;
  categoryColor: string | null;
  setCategoryColor: React.Dispatch<React.SetStateAction<string | null>>;
  categoryIcon: string | null;
  setCategoryIcon: React.Dispatch<React.SetStateAction<string | null>>;
  categoryTagIds: string[];
  setCategoryTagIds: React.Dispatch<React.SetStateAction<string[]>>;
  // ── Tag form state ──
  tagName: string;
  setTagName: React.Dispatch<React.SetStateAction<string>>;
  tagColor: string | null;
  setTagColor: React.Dispatch<React.SetStateAction<string | null>>;
  tagIcon: string | null;
  setTagIcon: React.Dispatch<React.SetStateAction<string | null>>;
  // ── Account form state ──
  newAccountName: string;
  setNewAccountName: React.Dispatch<React.SetStateAction<string>>;
  newAccountCurrency: string;
  setNewAccountCurrency: React.Dispatch<React.SetStateAction<string>>;
  newAccountIcon: string | null;
  setNewAccountIcon: React.Dispatch<React.SetStateAction<string | null>>;
  accountTagIds: string[];
  setAccountTagIds: React.Dispatch<React.SetStateAction<string[]>>;
  settingsIncluded: boolean;
  setSettingsIncluded: React.Dispatch<React.SetStateAction<boolean>>;
  settingsCarryOver: boolean;
  setSettingsCarryOver: React.Dispatch<React.SetStateAction<boolean>>;
  settingsInitialBalance: string;
  setSettingsInitialBalance: React.Dispatch<React.SetStateAction<string>>;
  settingsInitialDate: string;
  setSettingsInitialDate: React.Dispatch<React.SetStateAction<string>>;
  // ── Invitation state ──
  inviteToken: string | null;
  setInviteToken: React.Dispatch<React.SetStateAction<string | null>>;
  joinToken: string;
  setJoinToken: React.Dispatch<React.SetStateAction<string>>;
  invitationAccountId: string | null;
  setInvitationAccountId: React.Dispatch<React.SetStateAction<string | null>>;
  inviteName: string;
  setInviteName: React.Dispatch<React.SetStateAction<string>>;
  inviteExpiresDays: string;
  setInviteExpiresDays: React.Dispatch<React.SetStateAction<string>>;
  managedInvites: ManagedInvite[];
  setManagedInvites: React.Dispatch<React.SetStateAction<ManagedInvite[]>>;
  // ── Transfer form state ──
  transferFromId: string | null;
  setTransferFromId: React.Dispatch<React.SetStateAction<string | null>>;
  transferToId: string | null;
  setTransferToId: React.Dispatch<React.SetStateAction<string | null>>;
  transferSourceAmount: string;
  setTransferSourceAmount: React.Dispatch<React.SetStateAction<string>>;
  transferRate: string;
  setTransferRate: React.Dispatch<React.SetStateAction<string>>;
  transferTargetAmount: string;
  setTransferTargetAmount: React.Dispatch<React.SetStateAction<string>>;
  transferDate: string;
  setTransferDate: React.Dispatch<React.SetStateAction<string>>;
  transferNote: string;
  setTransferNote: React.Dispatch<React.SetStateAction<string>>;
  // ── Icon/date picker sub-state ──
  showIconPickerSheet: boolean;
  setShowIconPickerSheet: React.Dispatch<React.SetStateAction<boolean>>;
  iconPickerTarget: 'category' | 'account' | 'tag' | null;
  setIconPickerTarget: React.Dispatch<React.SetStateAction<'category' | 'account' | 'tag' | null>>;
  iconSearchQuery: string;
  setIconSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  showDatePicker: boolean;
  setShowDatePicker: React.Dispatch<React.SetStateAction<boolean>>;
  datePickerTarget: 'entry' | 'transfer';
  setDatePickerTarget: React.Dispatch<React.SetStateAction<'entry' | 'transfer'>>;
  dpYear: number;
  setDpYear: React.Dispatch<React.SetStateAction<number>>;
  dpMonth: number;
  setDpMonth: React.Dispatch<React.SetStateAction<number>>;
  showAcctPickerSheet: boolean;
  setShowAcctPickerSheet: React.Dispatch<React.SetStateAction<boolean>>;
  acctPickerSheetTarget: 'entry' | 'invite' | 'transfer-from' | 'transfer-to' | null;
  setAcctPickerSheetTarget: React.Dispatch<React.SetStateAction<'entry' | 'invite' | 'transfer-from' | 'transfer-to' | null>>;
  // ── Display/layout state ──
  sidebarTxCount: number;
  setSidebarTxCount: React.Dispatch<React.SetStateAction<number>>;
  sidebarCategoryFilter: string | null;
  setSidebarCategoryFilter: React.Dispatch<React.SetStateAction<string | null>>;
  scrollY: number;
  setScrollY: React.Dispatch<React.SetStateAction<number>>;
  avatarImgError: boolean;
  setAvatarImgError: React.Dispatch<React.SetStateAction<boolean>>;
  isCatPickerOpen: boolean;
  setIsCatPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dragHighlightedCatId: string | null;
  setDragHighlightedCatId: React.Dispatch<React.SetStateAction<string | null>>;
  showIntervalPicker: boolean;
  setShowIntervalPicker: React.Dispatch<React.SetStateAction<boolean>>;
  overviewCollapsed: boolean;
  setOverviewCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  spendingCollapsed: boolean;
  setSpendingCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  categoriesCollapsed: boolean;
  setCategoriesCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  // ── Refs ──
  mainScrollRef: React.RefObject<ScrollView | null>;
  noteInputRef: React.RefObject<TextInput | null>;
  catPickerAnim: Animated.Value;
  acctPickerAnim: Animated.Value;
  iconPickerAnim: Animated.Value;
  filterBarAnim: Animated.Value;
  catCellMeasurements: React.MutableRefObject<Record<string, { x: number; y: number; w: number; h: number }>>;
  catCellRefs: React.MutableRefObject<Record<string, View | null>>;
  isCatPickerOpenRef: React.MutableRefObject<boolean>;
  // ── Computed values ──
  selectedAccount: AppAccount | null;
  entryAccount: AppAccount | null;
  selectedCurrency: string;
  selectedTags: AppTag[];
  selectedCategories: AppCategory[];
  transferCategoryIds: string[];
  entryCategories: AppCategory[];
  entryTags: AppTag[];
  entryTagUsage: Record<string, number>;
  selectedTxs: AppTransaction[];
  recentCategoryAmounts: number[];
  noteSuggestions: string[];
  intervalBounds: { start: string; end: string };
  filteredSelectedTxs: AppTransaction[];
  visibleSelectedTxs: AppTransaction[];
  hasMoreTransactions: boolean;
  selectedSummary: AccountSummary;
  includedAccountIds: string[];
  filteredIncludedTxs: AppTransaction[];
  sidebarFilteredTxs: AppTransaction[];
  accountsById: Record<string, AppAccount>;
  tagsById: Record<string, AppTag>;
  categoriesById: Record<string, AppCategory>;
  includedAccountSummaries: IncludedAccountSummaryItem[];
  totalIncludedSummary: AccountSummary;
  totalIncludedBalance: number;
  overviewSummary: AccountSummary;
  categorySpendData: CategorySpendRow[];
  allIncludedCategorySpendData: CategorySpendRow[];
  themeColor: string;
  filteredIconNames: string[];
  categoryFilteredTxs: AppTransaction[] | null;
  categoryFilteredTxsVisible: AppTransaction[] | null;
  sortedSelectedCategories: AppCategory[];
  selectedFilterCategory: AppCategory | null;
  filterIsExpense: boolean;
  // ── Actions ──
  formatCurrency: (value: number, currencyOverride?: string) => string;
  txDisplayLabel: (tx: AppTransaction, fallback: string) => React.ReactNode;
  handleDashboardScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  cycleEntryAccount: () => void;
  appendNumpad: (char: string) => void;
  transferAppendNumpad: (char: string) => void;
  openDatePicker: () => void;
  openTransferDatePicker: () => void;
  openCatPicker: () => void;
  closeCatPicker: () => void;
  openAcctPickerSheet: (target: 'entry' | 'invite' | 'transfer-from' | 'transfer-to') => void;
  closeAcctPickerSheet: () => void;
  openIconPickerSheet: (target: 'category' | 'account' | 'tag') => void;
  closeIconPickerSheet: () => void;
  shareInvite: (token: string) => Promise<void>;
  openEntryModal: (type: TransactionType, categoryId?: string | null) => void;
  openEntryModalWithAmount: (type: TransactionType, amount: number, note?: string) => void;
  openEditTransaction: (tx: AppTransaction) => void;
  openCreateAccount: () => void;
  openEditAccount: (account: AppAccount) => void;
  deleteAccount: (account: AppAccount) => Promise<void>;
  saveCategory: (editingCategoryId?: string | null) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  deleteTransaction: (txId: string) => Promise<void>;
  toggleCategoryHidden: (categoryId: string) => Promise<void>;
  cloneTempCategory: (categoryId: string) => Promise<void>;
  createTag: () => Promise<void>;
  openCreateTag: () => void;
  openEditTag: (tag: AppTag) => void;
  saveTag: (editingTagId?: string | null) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  toggleTag: (id: string) => void;
  saveEntry: (editingTransactionId?: string | null) => Promise<void>;
  saveAccount: (editingAccountId?: string | null) => Promise<void>;
  openTransfer: () => void;
  saveTransfer: () => Promise<void>;
  loadManagedInvites: (accountId: string) => Promise<void>;
  openInvitationsModal: () => Promise<void>;
  saveInviteToken: (editingInviteId?: string | null) => Promise<void>;
  removeInviteToken: (inviteId: string) => Promise<void>;
  joinByToken: () => Promise<void>;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DashboardProvider({
  children,
  prefillEntry,
}: {
  children: React.ReactNode;
  prefillEntry?: { amount: number; type: 'income' | 'expense'; note?: string } | null;
}) {
  const { user, avatarUrl, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const { width, height } = useWindowDimensions();

  const data = useDashboardData(user);
  const {
    selectedAccountId, setSelectedAccountId,
    primaryAccountId, setPrimaryAccountId,
    entryAccountId, setEntryAccountId,
    excludedAccountIds, setExcludedAccountIds,
    saving, setSaving,
    reloading, setReloading,
    animMultiplier,
    missingSchemaColumns,
    pendingSelectedAccountIdRef,
    schemaAlertSignatureRef,
    saveAccountPrefs,
    animateIn,
    checkRequiredSchemaColumns,
  } = data;

  const queryClient = useQueryClient();
  const [reloadKey, setReloadKey] = useState(0);

  // ── Query hooks ───────────────────────────────────────────────────────────────
  const accountsQ = useAccountsQuery(user?.id);
  const accountsData: AccountsQueryData | undefined = accountsQ.data;
  const accounts: AppAccount[] = accountsData?.accounts ?? [];
  const accountIds: string[] = accounts.map((a) => a.id);
  const _sortedAccountKey = sortedKey(accountIds);
  // Ref so that setX wrappers below always read the latest key, even if account list changed
  const _sortedAccountKeyRef = useRef(_sortedAccountKey);
  useEffect(() => { _sortedAccountKeyRef.current = _sortedAccountKey; }, [_sortedAccountKey]);

  const categoriesQ = useCategoriesQuery(user?.id);
  const categories: AppCategory[] = categoriesQ.data?.categories ?? [];

  const transactionsQ = useTransactionsQuery(accountIds);
  const transactions: AppTransaction[] = transactionsQ.data ?? [];

  const tagsQ = useTagsQuery(user?.id ?? '');
  const tags: AppTag[] = tagsQ.data ?? [];

  const settingsQ = useAccountSettingsQuery(accounts);
  const accountSettings: Record<string, AccountSetting> = settingsQ.data ?? {};

  // loading = true only when there is truly no cached data yet (first-ever load)
  const loading = !accountsQ.data && (accountsQ.isPending || accountsQ.isFetching);

  // ── setX wrappers: write directly to the query cache ─────────────────────────
  // All existing mutation callbacks can continue calling setX unchanged.
  const setAccounts: React.Dispatch<React.SetStateAction<AppAccount[]>> = useCallback(
    (action) => {
      queryClient.setQueryData(
        accountsQueryKey(user?.id ?? ''),
        (old: AccountsQueryData | undefined) => {
          if (!old) return old;
          const next = typeof action === 'function' ? action(old.accounts) : action;
          return { ...old, accounts: next };
        },
      );
    },
    [queryClient, user?.id],
  );

  const setTransactions: React.Dispatch<React.SetStateAction<AppTransaction[]>> = useCallback(
    (action) => {
      queryClient.setQueryData(
        transactionsQueryKey(_sortedAccountKeyRef.current),
        (old: AppTransaction[] | undefined) => {
          if (old === undefined) return old;
          return typeof action === 'function' ? action(old) : action;
        },
      );
    },
    [queryClient],
  );

  const setCategories: React.Dispatch<React.SetStateAction<AppCategory[]>> = useCallback(
    (action) => {
      queryClient.setQueryData(
        categoriesQueryKey(user?.id ?? ''),
        (old: CategoriesQueryData | undefined) => {
          if (!old) return old;
          const next = typeof action === 'function' ? action(old.categories) : action;
          return { ...old, categories: next };
        },
      );
    },
    [queryClient, user?.id],
  );

  const setTags: React.Dispatch<React.SetStateAction<AppTag[]>> = useCallback(
    (action) => {
      queryClient.setQueryData(
        tagsQueryKey(user?.id ?? ''),
        (old: AppTag[] | undefined) => {
          if (old === undefined) return old;
          return typeof action === 'function' ? action(old) : action;
        },
      );
    },
    [queryClient],
  );

  const setAccountSettings: React.Dispatch<React.SetStateAction<Record<string, AccountSetting>>> =
    useCallback(
      (action) => {
        queryClient.setQueryData(
          accountSettingsQueryKey(_sortedAccountKeyRef.current),
          (old: Record<string, AccountSetting> | undefined) => {
            if (old === undefined) return old;
            return typeof action === 'function' ? action(old) : action;
          },
        );
      },
      [queryClient],
    );

  // ── hiddenCategoryIds: local state, initialized/synced from categories query ──
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (categoriesQ.data) {
      setHiddenCategoryIds(categoriesQ.data.hiddenCategoryIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesQ.dataUpdatedAt]);

  // ── Selection state init — runs when accounts query data arrives/refreshes ────
  useEffect(() => {
    if (!accountsData) return;
    const { accounts: loaded, primaryAccountId: pId, excludedAccountIds: excluded } = accountsData;
    setExcludedAccountIds(excluded);
    const resolvedPrimary = pId ?? loaded[0]?.id ?? null;
    setPrimaryAccountId(resolvedPrimary);
    setSelectedAccountId((prev) => {
      const pending = pendingSelectedAccountIdRef.current;
      if (pending && loaded.some((a) => a.id === pending)) {
        pendingSelectedAccountIdRef.current = null;
        return pending;
      }
      return prev ?? resolvedPrimary;
    });
    setEntryAccountId((prev) => {
      if (prev && loaded.some((a) => a.id === prev)) return prev;
      return resolvedPrimary;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsQ.dataUpdatedAt]);

  // ── Schema column check — runs once per sign-in ───────────────────────────────
  useEffect(() => {
    if (user) void checkRequiredSchemaColumns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Account management callbacks ──────────────────────────────────────────────
  const moveAccount = useCallback(
    (idx: number, direction: 'up' | 'down') => {
      queryClient.setQueryData(
        accountsQueryKey(user?.id ?? ''),
        (old: AccountsQueryData | undefined) => {
          if (!old) return old;
          const next = [...old.accounts];
          const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (swapIdx < 0 || swapIdx >= next.length) return old;
          [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
          saveAccountPrefs(next, primaryAccountId);
          return { ...old, accounts: next };
        },
      );
    },
    [queryClient, user?.id, primaryAccountId, saveAccountPrefs],
  );

  const setPrimary = useCallback(
    (id: string) => {
      setPrimaryAccountId(id);
      setSelectedAccountId(id);
      queryClient.setQueryData(
        accountsQueryKey(user?.id ?? ''),
        (old: AccountsQueryData | undefined) =>
          old ? { ...old, primaryAccountId: id } : old,
      );
      saveAccountPrefs(accounts, id);
    },
    [accounts, queryClient, user?.id, saveAccountPrefs, setPrimaryAccountId],
  );

  const toggleAccountExclusion = useCallback(
    (accountId: string) => {
      setExcludedAccountIds((prev) => {
        const next = prev.includes(accountId)
          ? prev.filter((id) => id !== accountId)
          : [...prev, accountId];
        saveAccountPrefs(accounts, primaryAccountId, next);
        queryClient.setQueryData(
          accountsQueryKey(user?.id ?? ''),
          (old: AccountsQueryData | undefined) =>
            old ? { ...old, excludedAccountIds: next } : old,
        );
        return next;
      });
    },
    [accounts, primaryAccountId, queryClient, user?.id, saveAccountPrefs],
  );

  /** Invalidates all dashboard queries → background refetch → count-up animation. */
  const reloadDashboard = useCallback(async () => {
    if (reloading || !user) return;
    setReloading(true);
    const key = _sortedAccountKeyRef.current;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['accounts', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['categories', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['transactions', key] }),
      queryClient.invalidateQueries({ queryKey: ['tags', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['account_settings', key] }),
    ]);
    setReloadKey((k) => k + 1);
    animateIn();
  }, [reloading, user, queryClient, animateIn, setReloading]);

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

  const { debts, getUserDebts } = useDebts(user);
  const pendingDebtCount = useMemo(() => debts.filter((d) => {
    if (d.status !== 'pending') return false;
    const iOwe = d.from_user === user?.id;
    const myConfirmed = iOwe ? d.from_confirmed : d.to_confirmed;
    if (myConfirmed) return false;
    const otherName = iOwe ? d.to_participant_name : d.from_participant_name;
    return !!otherName && otherName !== 'Unknown';
  }).length, [debts, user?.id]);

  useEffect(() => { void getUserDebts(); }, [getUserDebts]);

  // ── Filter state ──
  const [interval, setInterval] = useState<IntervalKey>('month');
  const [customStart, setCustomStart] = useState(todayIso());
  const [customEnd, setCustomEnd] = useState(todayIso());
  const [timeCursorOffset, setTimeCursorOffset] = useState(0);

  const INTERVAL_VIS_KEY = 'finduo_interval_visibility';
  const INTERVAL_DEFAULTS: Record<IntervalKey, boolean> = {
    day: true, week: true, month: true, year: true, all: true, custom: true,
  };
  const [intervalVisibility, setIntervalVisibility] = useState<Record<IntervalKey, boolean>>(() => {
    try {
      const stored = localStorage.getItem(INTERVAL_VIS_KEY);
      if (stored) return { ...INTERVAL_DEFAULTS, ...(JSON.parse(stored) as Record<IntervalKey, boolean>) };
    } catch {}
    return INTERVAL_DEFAULTS;
  });
  useEffect(() => {
    try { localStorage.setItem(INTERVAL_VIS_KEY, JSON.stringify(intervalVisibility)); } catch {}
  }, [intervalVisibility]);

  // ── UI/layout state ──
  const [viewModeOverride, setViewModeOverride] = useState<'desktop' | 'mobile' | null>(null);
  const [activeSection, setActiveSection] = useState<'pools' | 'lending' | 'settlements' | 'contacts' | null>(null);
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
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [showOnlyTransfers, setShowOnlyTransfers] = useState(false);

  // ── Entry form ──
  const [entryType, setEntryType] = useState<TransactionType>('expense');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayIso());
  const [entryCategoryId, setEntryCategoryId] = useState<string | null>(null);
  const [entryNote, setEntryNote] = useState('');
  const [entryTagIds, setEntryTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [noteFieldFocused, setNoteFieldFocused] = useState(false);

  // ── Category form ──
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<TransactionType>('expense');
  const [categoryColor, setCategoryColor] = useState<string | null>(null);
  const [categoryIcon, setCategoryIcon] = useState<string | null>(null);
  const [categoryTagIds, setCategoryTagIds] = useState<string[]>([]);

  // ── Tag form ──
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState<string | null>(null);
  const [tagIcon, setTagIcon] = useState<string | null>(null);

  // ── Account form ──
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountCurrency, setNewAccountCurrency] = useState('USD');
  const [newAccountIcon, setNewAccountIcon] = useState<string | null>(null);
  const [accountTagIds, setAccountTagIds] = useState<string[]>([]);
  const [settingsIncluded, setSettingsIncluded] = useState(true);
  const [settingsCarryOver, setSettingsCarryOver] = useState(true);
  const [settingsInitialBalance, setSettingsInitialBalance] = useState('0');
  const [settingsInitialDate, setSettingsInitialDate] = useState(todayIso());

  // ── Invitation state ──
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState('');
  const [invitationAccountId, setInvitationAccountId] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteExpiresDays, setInviteExpiresDays] = useState('7');
  const [managedInvites, setManagedInvites] = useState<ManagedInvite[]>([]);

  // ── Transfer form ──
  const [transferFromId, setTransferFromId] = useState<string | null>(null);
  const [transferToId, setTransferToId] = useState<string | null>(null);
  const [transferSourceAmount, setTransferSourceAmount] = useState('');
  const [transferRate, setTransferRate] = useState('');
  const [transferTargetAmount, setTransferTargetAmount] = useState('');
  const [transferDate, setTransferDate] = useState(todayIso());
  const [transferNote, setTransferNote] = useState('');

  // ── Icon/date picker sub-state ──
  const [showIconPickerSheet, setShowIconPickerSheet] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<'category' | 'account' | 'tag' | null>(null);
  const [iconSearchQuery, setIconSearchQuery] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'entry' | 'transfer'>('entry');
  const [dpYear, setDpYear] = useState(() => new Date().getFullYear());
  const [dpMonth, setDpMonth] = useState(() => new Date().getMonth());
  const [showAcctPickerSheet, setShowAcctPickerSheet] = useState(false);
  const [acctPickerSheetTarget, setAcctPickerSheetTarget] = useState<'entry' | 'invite' | 'transfer-from' | 'transfer-to' | null>(null);

  // ── Display/layout state ──
  const [sidebarTxCount, setSidebarTxCount] = useState(12);
  const [sidebarCategoryFilter, setSidebarCategoryFilter] = useState<string | null>(null);
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);
  const [overviewCollapsed, setOverviewCollapsed] = useState(false);
  const [spendingCollapsed, setSpendingCollapsed] = useState(true);
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const [isCatPickerOpen, setIsCatPickerOpen] = useState(false);
  const [dragHighlightedCatId, setDragHighlightedCatId] = useState<string | null>(null);

  // ── Refs ──
  const noteInputRef = useRef<TextInput | null>(null);
  const mainScrollRef = useRef<ScrollView | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catPickerAnim = useRef(new Animated.Value(0)).current;
  const isCatPickerOpenRef = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const acctPickerAnim = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const iconPickerAnim = useRef(new Animated.Value(0)).current;
  const filterBarAnim = useRef(new Animated.Value(0)).current;
  const catCellMeasurements = useRef<Record<string, { x: number; y: number; w: number; h: number }>>({});
  const catCellRefs = useRef<Record<string, View | null>>({});

  // ── Layout flags ──
  const isDesktopBrowser = Platform.OS === 'web' && width >= 1024;
  const desktopView = isDesktopBrowser && viewModeOverride !== 'mobile';
  const framedMobileView = isDesktopBrowser && viewModeOverride === 'mobile';

  // ── Computed: account lookups ──
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const entryAccount = useMemo(
    () => accounts.find((a) => a.id === entryAccountId) ?? null,
    [accounts, entryAccountId],
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

  // ── Computed: categories/tags/transactions ──
  const selectedCategories = useMemo(
    () => categories.filter((c) => !hiddenCategoryIds.has(c.id)),
    [categories, hiddenCategoryIds],
  );

  const transferCategoryIds = useMemo(
    () => categories.filter((c) => c.name === 'Transfer').map((c) => c.id),
    [categories],
  );

  const entryCategories = useMemo(
    () => categories
      .filter((c) => !hiddenCategoryIds.has(c.id))
      .filter((c) => c.type === entryType),
    [categories, hiddenCategoryIds, entryType],
  );

  const entryTags = useMemo(() => tags, [tags]);

  const entryTagUsage = useMemo(() => {
    const usage: Record<string, number> = {};
    if (!entryCategoryId) return usage;
    for (const tx of transactions) {
      if (tx.account_id !== entryAccountId) continue;
      if (tx.category_id !== entryCategoryId) continue;
      for (const tagId of tx.tag_ids ?? []) {
        usage[tagId] = (usage[tagId] ?? 0) + 1;
      }
    }
    return usage;
  }, [entryCategoryId, entryAccountId, transactions]);

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

  // ── Computed: interval ──
  const intervalBounds = useMemo(() => {
    if (interval === 'all') return { start: '', end: '' };
    if (interval === 'custom') return { start: customStart, end: customEnd };

    const now = new Date();
    // Use local date components (not toISOString) to avoid UTC timezone shift:
    // new Date(year, month, day) constructs local midnight; toISOString() would
    // produce the previous day's UTC date for timezones ahead of UTC (UTC+N).
    const isoDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (interval === 'day') {
      const d = new Date(now);
      d.setDate(d.getDate() + timeCursorOffset);
      const ds = isoDate(d);
      return { start: ds, end: ds };
    }

    if (interval === 'week') {
      const dayOfWeek = now.getDay(); // 0=Sun
      const daysToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + daysToMon + timeCursorOffset * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: isoDate(monday), end: isoDate(sunday) };
    }

    if (interval === 'month') {
      const target = new Date(now.getFullYear(), now.getMonth() + timeCursorOffset, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0);
      return { start: isoDate(target), end: isoDate(lastDay) };
    }

    // year
    const targetYear = now.getFullYear() + timeCursorOffset;
    return { start: `${targetYear}-01-01`, end: `${targetYear}-12-31` };
  }, [customEnd, customStart, interval, timeCursorOffset]);

  const inInterval = useCallback((date: string) => {
    if (interval === 'all') return true;
    if (!intervalBounds.start || !intervalBounds.end) return true;
    return date >= intervalBounds.start && date <= intervalBounds.end;
  }, [interval, intervalBounds.end, intervalBounds.start]);

  const intervalLabel = useMemo(() => {
    if (interval === 'all') return 'All Time';
    if (interval === 'custom') return `${customStart} – ${customEnd}`;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const short = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (interval === 'day') {
      if (timeCursorOffset === 0) return 'Today';
      if (timeCursorOffset === -1) return 'Yesterday';
      return intervalBounds.start;
    }
    if (interval === 'week') {
      const [sy, sm, sd] = intervalBounds.start.split('-').map(Number);
      const [ey, em, ed] = intervalBounds.end.split('-').map(Number);
      const yearSuffix = sy !== ey ? ` ${ey}` : ` ${ey}`;
      return `${short[sm-1]} ${sd} – ${short[em-1]} ${ed}${yearSuffix}`;
    }
    if (interval === 'month') {
      const [y, m] = intervalBounds.start.split('-').map(Number);
      return `${monthNames[m-1]} ${y}`;
    }
    return intervalBounds.start.slice(0, 4);
  }, [interval, timeCursorOffset, intervalBounds, customStart, customEnd]);

  const navigateInterval = useCallback((dir: 'prev' | 'next') => {
    if (interval === 'all' || interval === 'custom') return;
    setTimeCursorOffset((prev) => prev + (dir === 'prev' ? -1 : 1));
  }, [interval]);

  const filteredSelectedTxs = useMemo(
    () => selectedTxs.filter((t) => {
      if (!inInterval(t.date)) return false;
      if (selectedTagFilter && !(t.tag_ids ?? []).includes(selectedTagFilter)) return false;
      return true;
    }),
    [inInterval, selectedTxs, selectedTagFilter],
  );

  const visibleSelectedTxs = useMemo(
    () => filteredSelectedTxs.slice(0, visibleTransactionsCount),
    [filteredSelectedTxs, visibleTransactionsCount],
  );

  const hasMoreTransactions = visibleTransactionsCount < filteredSelectedTxs.length;

  // ── Computed: account summaries ──
  const buildAccountSummary = useCallback((accountId: string): AccountSummary => {
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
      .filter((a) => (accountSettings[a.id]?.included_in_balance ?? true) && !excludedAccountIds.includes(a.id))
      .map((a) => a.id),
    [accountSettings, accounts, excludedAccountIds],
  );

  const filteredIncludedTxs = useMemo(
    () =>
      transactions
        .filter((t) => {
          if (!includedAccountIds.includes(t.account_id) || !inInterval(t.date)) return false;
          if (selectedTagFilter && !(t.tag_ids ?? []).includes(selectedTagFilter)) return false;
          return true;
        })
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [transactions, includedAccountIds, inInterval, selectedTagFilter],
  );

  const sidebarFilteredTxs = useMemo(() => {
    if (!sidebarCategoryFilter) return filteredIncludedTxs;
    return filteredIncludedTxs.filter((tx) =>
      sidebarCategoryFilter === 'uncategorized' ? !tx.category_id : tx.category_id === sidebarCategoryFilter,
    );
  }, [filteredIncludedTxs, sidebarCategoryFilter]);

  const accountsById = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const tagsById = useMemo(
    () => Object.fromEntries(tags.map((t) => [t.id, t])),
    [tags],
  );

  const categoriesById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const txDisplayLabel = useCallback((tx: AppTransaction, fallback: string): React.ReactNode => {
    const txTags = (tx.tag_ids ?? []).map((id) => tagsById[id]).filter(Boolean);
    const note = tx.note?.trim() || '';
    if (txTags.length === 0 && !note) return categoriesById[tx.category_id]?.name ?? fallback;
    return (
      <>
        {txTags.map((tag) => (
          <React.Fragment key={tag.id}>
            {tag.icon ? <Icon name={tag.icon as any} size={12} color={tag.color ?? '#8FA8C9'} /> : null}
            <Text style={{ color: tag.color ?? '#8FA8C9' }}>{tag.icon ? ' ' : ''}#{tag.name} </Text>
          </React.Fragment>
        ))}
        {note ? <Text>{note}</Text> : null}
      </>
    );
  }, [tagsById, categoriesById]);

  const includedAccountSummaries = useMemo((): IncludedAccountSummaryItem[] => {
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

  const totalIncludedSummary = useMemo((): AccountSummary => {
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

  // ── Computed: spend data ──
  const categorySpendData = useMemo((): CategorySpendRow[] => {
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
        const cat = lookupCats.find((c) => c.id === id);
        const name = cat?.name ?? (id === 'uncategorized' ? 'Uncategorized' : 'Other');
        const color = cat?.color ?? null;
        return { id, name, total, color };
      })
      .sort((a, b) => b.total - a.total);

    const max = rows[0]?.total ?? 0;
    return rows.map((r) => ({
      ...r,
      widthPercent: max > 0 ? Math.max(8, Math.round((r.total / max) * 100)) : 0,
    }));
  }, [showAccountOverviewPicker, filteredIncludedTxs, filteredSelectedTxs, categories, selectedCategories, transferCategoryIds]);

  const allIncludedCategorySpendData = useMemo((): CategorySpendRow[] => {
    const map: Record<string, number> = {};
    for (const tx of filteredIncludedTxs) {
      if (tx.type !== 'expense') continue;
      if (tx.category_id && transferCategoryIds.includes(tx.category_id)) continue;
      const key = tx.category_id ?? 'uncategorized';
      map[key] = (map[key] ?? 0) + (Number(tx.amount) || 0);
    }
    const rows = Object.entries(map)
      .map(([id, total]) => {
        const cat = categories.find((c) => c.id === id);
        return {
          id,
          name: cat?.name ?? (id === 'uncategorized' ? 'Uncategorized' : 'Other'),
          color: cat?.color ?? null,
          total,
        };
      })
      .sort((a, b) => b.total - a.total);
    const max = rows[0]?.total ?? 0;
    return rows.map((r) => ({
      ...r,
      widthPercent: max > 0 ? Math.max(8, Math.round((r.total / max) * 100)) : 0,
    }));
  }, [filteredIncludedTxs, categories, transferCategoryIds]);

  // ── Computed: theme/filter/sort ──
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

  // ── Effects ──
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
  }, [missingSchemaColumns, schemaAlertSignatureRef]);

  useEffect(() => {
    const active = !!(selectedCategoryFilter || selectedTagFilter || showOnlyTransfers);
    Animated.timing(filterBarAnim, { toValue: active ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  }, [selectedCategoryFilter, selectedTagFilter, showOnlyTransfers, filterBarAnim]);

  useEffect(() => { setAvatarImgError(false); }, [avatarUrl]);

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

  // Reset navigation cursor when interval type changes
  useEffect(() => { setTimeCursorOffset(0); }, [interval]);

  // ── Scroll / numpad callbacks ──
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
  }, [accounts, entryAccountId, setEntryAccountId]);

  const appendNumpad = useCallback((char: string) => {
    setEntryAmount((prev) => {
      if (char === 'C') return '';
      if (char === '<') return prev.slice(0, -1);
      if (char === '.') {
        if (prev.includes('.')) return prev;
        return prev ? `${prev}.` : '0.';
      }
      if (char === '00') return `${prev}00`;
      if (char === '000') return `${prev}000`;
      return `${prev}${char}`;
    });
  }, []);

  const transferAppendNumpad = useCallback((char: string) => {
    setTransferSourceAmount((prev) => {
      if (char === 'C') return '';
      if (char === '<') return prev.slice(0, -1);
      if (char === '.') {
        if (prev.includes('.')) return prev;
        return prev ? `${prev}.` : '0.';
      }
      if (char === '00') return prev.includes('.') ? prev : `${prev}00`;
      if (char === '000') return prev.includes('.') ? prev : `${prev}000`;
      return `${prev}${char}`;
    });
  }, []);

  // ── Picker open/close callbacks ──
  const openDatePicker = useCallback(() => {
    const parts = entryDate.split('-');
    setDpYear(Number(parts[0]) || new Date().getFullYear());
    setDpMonth((Number(parts[1]) || new Date().getMonth() + 1) - 1);
    setDatePickerTarget('entry');
    setShowDatePicker(true);
  }, [entryDate]);

  const openTransferDatePicker = useCallback(() => {
    const parts = transferDate.split('-');
    setDpYear(Number(parts[0]) || new Date().getFullYear());
    setDpMonth((Number(parts[1]) || new Date().getMonth() + 1) - 1);
    setDatePickerTarget('transfer');
    setShowDatePicker(true);
  }, [transferDate]);

  const openCatPicker = useCallback(() => {
    isCatPickerOpenRef.current = true;
    setIsCatPickerOpen(true);
    catPickerAnim.setValue(1);
  }, [catPickerAnim]);

  const closeCatPicker = useCallback(() => {
    isCatPickerOpenRef.current = false;
    catPickerAnim.setValue(0);
    setIsCatPickerOpen(false);
    setDragHighlightedCatId(null);
  }, [catPickerAnim]);

  const openAcctPickerSheet = useCallback((target: 'entry' | 'invite' | 'transfer-from' | 'transfer-to') => {
    setAcctPickerSheetTarget(target);
    setShowAcctPickerSheet(true);
    acctPickerAnim.setValue(1);
  }, [acctPickerAnim]);

  const closeAcctPickerSheet = useCallback(() => {
    acctPickerAnim.setValue(0);
    setShowAcctPickerSheet(false);
    setAcctPickerSheetTarget(null);
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

  // ── Share ──
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

  // ── Modal open callbacks ──
  const openEntryModal = useCallback((type: TransactionType, categoryId?: string | null) => {
    setEntryType(type);
    setEntryAmount('');
    setEntryDate(todayIso());
    setEntryCategoryId(categoryId ?? null);
    setEntryNote('');
    setEntryTagIds([]);
    setNewTagName('');
    setEntryAccountId(selectedAccountId);
    isCatPickerOpenRef.current = false;
    setIsCatPickerOpen(false);
    catPickerAnim.setValue(0);
    navigation.navigate('Entry' as never);
  }, [catPickerAnim, selectedAccountId, setEntryAccountId, navigation]);

  const openEntryModalWithAmount = useCallback((
    type: TransactionType,
    amount: number,
    note?: string,
  ) => {
    setEntryType(type);
    setEntryAmount(String(Math.round(amount * 100) / 100));
    setEntryDate(todayIso());
    setEntryCategoryId(null);
    setEntryNote(note ?? '');
    setEntryTagIds([]);
    setNewTagName('');
    setEntryAccountId(selectedAccountId);
    isCatPickerOpenRef.current = false;
    setIsCatPickerOpen(false);
    catPickerAnim.setValue(0);
    navigation.navigate('Entry' as never);
  }, [catPickerAnim, selectedAccountId, setEntryAccountId, navigation]);

  // Open the entry modal pre-filled when the Dashboard is navigated to with prefill params.
  // Uses _key (e.g. debt ID) so re-navigating with a new prefill triggers the effect again.
  useEffect(() => {
    if (prefillEntry) {
      openEntryModalWithAmount(prefillEntry.type, prefillEntry.amount, prefillEntry.note);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(prefillEntry as any)?._key]);

  const openEditTransaction = useCallback((tx: AppTransaction) => {
    setEntryType(tx.type);
    setEntryAmount(String(Math.abs(Number(tx.amount) || 0)));
    setEntryDate(tx.date);
    setEntryCategoryId(tx.category_id ?? null);
    setEntryNote(tx.note ?? '');
    setEntryTagIds(tx.tag_ids);
    setEntryAccountId(tx.account_id);
    isCatPickerOpenRef.current = false;
    setIsCatPickerOpen(false);
    catPickerAnim.setValue(0);
    navigation.navigate('Entry' as never, { transactionId: tx.id } as never);
  }, [catPickerAnim, setEntryAccountId, navigation]);

  const openCreateAccount = useCallback(() => {
    setNewAccountName('');
    setNewAccountCurrency(selectedAccount?.currency ?? 'USD');
    setSettingsIncluded(true);
    setSettingsCarryOver(true);
    setSettingsInitialBalance('0');
    setSettingsInitialDate(todayIso());
    setAccountTagIds([]);
    setNewAccountIcon(null);
    navigation.navigate('Account' as never);
  }, [selectedAccount?.currency, navigation]);

  const openEditAccount = useCallback((account: AppAccount) => {
    const settings = accountSettings[account.id];
    setNewAccountName(account.name);
    setNewAccountCurrency(account.currency);
    setNewAccountIcon(account.icon ?? null);
    setSettingsIncluded(settings?.included_in_balance ?? true);
    setSettingsCarryOver(settings?.carry_over_balance ?? true);
    setSettingsInitialBalance(String(settings?.initial_balance ?? 0));
    setSettingsInitialDate(settings?.initial_balance_date ?? account.created_at?.slice(0, 10) ?? todayIso());
    setAccountTagIds((account.tag_ids ?? []) as string[]);
    navigation.navigate('Account' as never, { accountId: account.id } as never);
  }, [accountSettings, navigation]);

  // ── CRUD callbacks ──
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
      const { error: rpcError } = await supabase.rpc('delete_own_account', {
        p_account_id: account.id,
      });
      if (rpcError) throw rpcError;

      if (selectedAccountId === account.id) {
        const nextAccount = accounts.find((item) => item.id !== account.id) ?? null;
        pendingSelectedAccountIdRef.current = nextAccount?.id ?? null;
        setSelectedAccountId(nextAccount?.id ?? null);
      }

      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      setTransactions((prev) => prev.filter((tx) => tx.account_id !== account.id));
    } catch (err) {
      Alert.alert('Remove account failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [accounts, selectedAccountId, user, pendingSelectedAccountIdRef, setSelectedAccountId, setAccounts, setTransactions, setSaving]);

  const saveCategory = useCallback(async (editingCategoryId?: string | null) => {
    if (!user) {
      Alert.alert('Not signed in', 'Sign in to create categories.');
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
        setCategories((prev) => prev.map((c) =>
          c.id === editingCategoryId
            ? { ...c, name: categoryName.trim(), type: categoryType, color: categoryColor, icon: categoryIcon, tag_ids: categoryTagIds }
            : c,
        ));
      } else {
        const { data: newCat, error } = await supabase.from('categories').insert({
          user_id: user.id,
          name: categoryName.trim(),
          type: categoryType,
          color: categoryColor,
          icon: categoryIcon,
          tag_ids: categoryTagIds,
        }).select('id,user_id,name,type,color,icon,tag_ids').single();
        if (error) throw error;
        if (newCat) {
          setCategories((prev) => [...prev, newCat as AppCategory].sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
      setCategoryColor(null);
      setCategoryIcon(null);
      setCategoryTagIds([]);
    } catch (err) {
      Alert.alert('Save category failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [categoryColor, categoryIcon, categoryName, categoryTagIds, categoryType, user, setCategories, setSaving]);

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
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      setTransactions((prev) => prev.map((tx) => tx.category_id === categoryId ? { ...tx, category_id: null } : tx));
    } catch (err) {
      Alert.alert('Remove category failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [setCategories, setTransactions, setSaving]);

  const deleteTransaction = useCallback(async (txId: string) => {
    setSaving(true);
    try {
      const { error: tagsError } = await supabase
        .from('transaction_tags')
        .delete()
        .eq('transaction_id', txId);
      if (tagsError && !isMissingTableError(tagsError)) throw tagsError;

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', txId);
      if (error) throw error;
      setTransactions((prev) => prev.filter((tx) => tx.id !== txId));
    } catch (err) {
      Alert.alert('Delete failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [setTransactions, setSaving]);

  const toggleCategoryHidden = useCallback(async (categoryId: string) => {
    if (!user) return;
    const isHidden = hiddenCategoryIds.has(categoryId);
    try {
      if (isHidden) {
        await supabase
          .from('user_hidden_categories')
          .delete()
          .eq('user_id', user.id)
          .eq('category_id', categoryId);
        setHiddenCategoryIds((prev) => {
          const next = new Set(prev);
          next.delete(categoryId);
          return next;
        });
      } else {
        await supabase
          .from('user_hidden_categories')
          .insert({ user_id: user.id, category_id: categoryId });
        setHiddenCategoryIds((prev) => new Set([...prev, categoryId]));
      }
    } catch (err) {
      Alert.alert('Failed to update', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [hiddenCategoryIds, setHiddenCategoryIds, user]);

  const cloneTempCategory = useCallback(async (categoryId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      logAPI('supabase://rpc/clone_temp_category', { source: 'category_modal.keep_button', action: 'cloneTempCategory' });
      const { error } = await supabase.rpc('clone_temp_category', { p_category_id: categoryId });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['categories', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['transactions', _sortedAccountKeyRef.current] });
    } catch (err) {
      Alert.alert('Failed to keep category', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [user, queryClient, setSaving]);

  const createTag = useCallback(async () => {
    if (!newTagName.trim()) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({ account_id: null, user_id: user!.id, name: newTagName.trim() })
        .select('id,user_id,account_id,name,color')
        .single();

      if (error) throw error;
      if (data?.id) {
        setEntryTagIds((prev) => (prev.includes(data.id) ? prev : [...prev, data.id]));
        setTags((prev) => [...prev, data as AppTag].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setNewTagName('');
    } catch (err) {
      Alert.alert('Create tag failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [newTagName, setTags, setSaving]);

  const openCreateTag = useCallback(() => {
    setTagName('');
    setTagColor(null);
    setTagIcon(null);
    navigation.navigate('Tag' as never);
  }, [navigation]);

  const openEditTag = useCallback((tag: AppTag) => {
    setTagName(tag.name);
    setTagColor(tag.color ?? null);
    setTagIcon(tag.icon ?? null);
    navigation.navigate('Tag' as never, { tagId: tag.id } as never);
  }, [navigation]);

  const saveTag = useCallback(async (editingTagId?: string | null) => {
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
        setTags((prev) => prev.map((t) =>
          t.id === editingTagId ? { ...t, name: tagName.trim(), color: tagColor, icon: tagIcon } : t,
        ));
      } else {
        const { data: newTag, error } = await supabase
          .from('tags')
          .insert({ account_id: null, user_id: user!.id, name: tagName.trim(), color: tagColor, icon: tagIcon })
          .select('id,user_id,account_id,name,color,icon')
          .single();
        if (error) throw error;
        if (newTag) {
          setTags((prev) => [...prev, newTag as AppTag].sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
      setTagColor(null);
      setTagIcon(null);
    } catch (err) {
      Alert.alert('Save tag failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [tagColor, tagIcon, tagName, setTags, setSaving]);

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
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      setTransactions((prev) => prev.map((tx) => ({
        ...tx,
        tag_ids: tx.tag_ids.filter((id) => id !== tagId),
      })));
    } catch (err) {
      Alert.alert('Remove tag failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [setTags, setTransactions, setSaving]);

  const toggleTag = useCallback((id: string) => {
    setEntryTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const saveEntry = useCallback(async (editingTransactionId?: string | null) => {
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

      if (editingTransactionId) {
        setTransactions((prev) => prev.map((tx) =>
          tx.id === editingTransactionId
            ? { ...tx, account_id: entryAccountId!, category_id: entryCategoryId ?? null, amount, note: entryNote.trim() || null, type: entryType, date: entryDate, tag_ids: entryTagIds }
            : tx,
        ).sort((a, b) => b.date.localeCompare(a.date)));
      } else {
        const newTx: AppTransaction = {
          id: txId!,
          account_id: entryAccountId!,
          category_id: entryCategoryId ?? null,
          amount,
          note: entryNote.trim() || null,
          type: entryType,
          date: entryDate,
          created_at: new Date().toISOString(),
          tag_ids: entryTagIds,
        };
        setTransactions((prev) => [newTx, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      }

    } catch (err) {
      Alert.alert('Save entry failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [
    entryAccountId,
    entryAmount,
    entryCategoryId,
    entryDate,
    entryNote,
    entryTagIds,
    entryType,
    user,
    setTransactions,
    setSaving,
  ]);

  const saveAccount = useCallback(async (editingAccountId?: string | null) => {
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

        // Ensure the creator is a member of their own account (required by RLS)
        if (accountId) {
          await supabase.from('account_members').upsert(
            { account_id: accountId, user_id: user.id, role: 'owner' },
            { onConflict: 'account_id,user_id', ignoreDuplicates: true },
          );
        }
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

      const updatedSettings: AccountSetting = {
        account_id: accountId,
        included_in_balance: settingsIncluded,
        carry_over_balance: settingsCarryOver,
        initial_balance: initial,
        initial_balance_date: settingsInitialDate,
      };
      setAccountSettings((prev) => ({ ...prev, [accountId]: updatedSettings }));

      if (editingAccountId) {
        setAccounts((prev) => prev.map((a) =>
          a.id === editingAccountId
            ? { ...a, name: newAccountName.trim(), currency: newAccountCurrency, tag_ids: accountTagIds, icon: newAccountIcon ?? null }
            : a,
        ));
      } else {
        const newAccount: AppAccount = {
          id: accountId,
          name: newAccountName.trim(),
          currency: newAccountCurrency,
          tag_ids: [],
          icon: newAccountIcon ?? null,
          created_at: new Date().toISOString(),
          created_by: user.id,
        };
        setAccounts((prev) => [...prev, newAccount]);
        setNewAccountName('');
      }
      setAccountTagIds([]);
    } catch (err) {
      Alert.alert('Save account failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [
    accountTagIds,
    newAccountCurrency,
    newAccountIcon,
    newAccountName,
    settingsCarryOver,
    settingsIncluded,
    settingsInitialBalance,
    settingsInitialDate,
    user,
    pendingSelectedAccountIdRef,
    setSelectedAccountId,
    setEntryAccountId,
    setAccountSettings,
    setAccounts,
    setSaving,
  ]);

  const openTransfer = useCallback(() => {
    if (accounts.length < 2) {
      Alert.alert('Not enough accounts', 'Create at least two accounts for transfer.');
      return;
    }

    // Pre-populate with last transfer's accounts if available
    const transferTxs = transactions.filter(
      (tx) => tx.category_id != null && transferCategoryIds.includes(tx.category_id),
    );
    const lastExpense = transferTxs.find((tx) => tx.type === 'expense');
    const lastIncome = transferTxs.find((tx) => tx.type === 'income');
    const lastFromId = lastExpense?.account_id ?? null;
    const lastToId = lastIncome?.account_id ?? null;
    const validFrom = lastFromId && accounts.find((a) => a.id === lastFromId) ? lastFromId : null;
    const validTo = lastToId && accounts.find((a) => a.id === lastToId) && lastToId !== validFrom ? lastToId : null;

    const from = validFrom ?? selectedAccountId ?? accounts[0].id;
    const to = validTo ?? accounts.find((a) => a.id !== from)?.id ?? null;

    setTransferFromId(from);
    setTransferToId(to);
    setTransferSourceAmount('');
    setTransferRate('');
    setTransferTargetAmount('');
    setTransferDate(todayIso());
    setTransferNote('');
    navigation.navigate('Transfer' as never);
  }, [accounts, selectedAccountId, transactions, transferCategoryIds, navigation]);

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

      const findOrCreateCat = async (type: 'expense' | 'income') => {
        // Use the global system Transfer category (is_default = true, no user owner).
        // First check local state to avoid a round-trip when categories are already loaded.
        const local = categories.find((c) => c.is_default && c.name === 'Transfer' && c.type === type);
        if (local) return local.id;
        const { data } = await supabase
          .from('categories')
          .select('id')
          .eq('is_default', true)
          .eq('name', 'Transfer')
          .eq('type', type)
          .limit(1)
          .maybeSingle();
        return (data?.id ?? null) as string | null;
      };

      const [transferExpenseCatId, transferIncomeCatId] = await Promise.all([
        findOrCreateCat('expense'),
        findOrCreateCat('income'),
      ]);

      const { data: srcData, error: sourceError } = await supabase.from('transactions').insert({
        account_id: transferFromId,
        category_id: transferExpenseCatId,
        amount: sourceAmount,
        type: 'expense',
        note: sourceNote,
        date: transferDate,
        created_by: user.id,
      }).select('id').single();
      if (sourceError) throw sourceError;

      const { data: tgtData, error: targetError } = await supabase.from('transactions').insert({
        account_id: transferToId,
        category_id: transferIncomeCatId,
        amount: targetAmount,
        type: 'income',
        note: targetNote,
        date: transferDate,
        created_by: user.id,
      }).select('id').single();
      if (targetError) throw targetError;

      setCategories((prev) => {
        let updated = [...prev];
        if (transferExpenseCatId && !prev.find((c) => c.id === transferExpenseCatId)) {
          updated.push({ id: transferExpenseCatId, user_id: null, name: 'Transfer', type: 'expense', color: '#a855f7', icon: 'Replace', tag_ids: [], is_default: true });
        }
        if (transferIncomeCatId && !prev.find((c) => c.id === transferIncomeCatId)) {
          updated.push({ id: transferIncomeCatId, user_id: null, name: 'Transfer', type: 'income', color: '#a855f7', icon: 'Replace', tag_ids: [], is_default: true });
        }
        return updated.sort((a, b) => a.name.localeCompare(b.name));
      });

      const now = new Date().toISOString();
      setTransactions((prev) => {
        const newTxs: AppTransaction[] = [];
        if (srcData?.id) newTxs.push({ id: srcData.id, account_id: transferFromId!, category_id: transferExpenseCatId, amount: sourceAmount, note: sourceNote, type: 'expense', date: transferDate, created_at: now, tag_ids: [] });
        if (tgtData?.id) newTxs.push({ id: tgtData.id, account_id: transferToId!, category_id: transferIncomeCatId, amount: targetAmount, note: targetNote, type: 'income', date: transferDate, created_at: now, tag_ids: [] });
        return [...newTxs, ...prev].sort((a, b) => b.date.localeCompare(a.date));
      });

      Alert.alert('Transfer saved', `${formatCurrency(sourceAmount, fromAccount.currency)} -> ${formatCurrency(targetAmount, toAccount.currency)}`);
    } catch (err) {
      Alert.alert('Transfer failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [
    accounts,
    formatCurrency,
    transferDate,
    transferFromId,
    transferNote,
    transferRate,
    transferSourceAmount,
    transferTargetAmount,
    transferToId,
    user,
    setCategories,
    setTransactions,
    setSaving,
  ]);

  // ── Invitation callbacks ──
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
    setJoinToken('');
    navigation.navigate('Invitations' as never);

    if (!nextAccountId) {
      setManagedInvites([]);
      return;
    }

    try {
      await loadManagedInvites(nextAccountId);
    } catch (err) {
      Alert.alert('Invitations error', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [accounts, loadManagedInvites, selectedAccountId, navigation]);

  const saveInviteToken = useCallback(async (editingInviteId?: string | null) => {
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
      await loadManagedInvites(invitationAccountId);
    } catch (err) {
      Alert.alert('Invite save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [invitationAccountId, inviteExpiresDays, inviteName, loadManagedInvites, shareInvite, user, setSaving]);

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
  }, [invitationAccountId, loadManagedInvites, setSaving]);

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

      const { error: memberError } = await supabase.from('account_members').upsert(
        { account_id: invite.account_id, user_id: user.id, role: 'member' },
        { onConflict: 'account_id,user_id', ignoreDuplicates: true },
      );
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
      await queryClient.invalidateQueries({ queryKey: ['accounts', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['categories', user.id] });
      if (_sortedAccountKey) {
        await queryClient.invalidateQueries({ queryKey: ['transactions', _sortedAccountKey] });
        await queryClient.invalidateQueries({ queryKey: ['tags', user.id] });
        await queryClient.invalidateQueries({ queryKey: ['account_settings', _sortedAccountKey] });
      }
      Alert.alert('Joined', 'Shared account added.');
    } catch (err) {
      Alert.alert('Join failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [invitationAccountId, joinToken, queryClient, _sortedAccountKey, loadManagedInvites, user, setSaving]);

  // ── Context value ──
  const value: DashboardContextValue = {
    user, avatarUrl, signOut,
    navigation,
    activeSection, setActiveSection,
    width, height,
    isDesktopBrowser, desktopView, framedMobileView,
    // useDashboardData
    accounts, setAccounts,
    categories, setCategories,
    tags, setTags,
    transactions, setTransactions,
    accountSettings, setAccountSettings,
    hiddenCategoryIds, setHiddenCategoryIds,
    selectedAccountId, setSelectedAccountId,
    primaryAccountId,
    entryAccountId, setEntryAccountId,
    excludedAccountIds,
    loading, reloading, reloadKey, animMultiplier,
    saving, setSaving,
    missingSchemaColumns,
    pendingSelectedAccountIdRef,
    schemaAlertSignatureRef,
    reloadDashboard,
    moveAccount, setPrimary, toggleAccountExclusion,
    // useFriends
    friends, pendingRequests, friendsLoading, friendAccountMap, loadFriends,
    friendSendRequest, friendAcceptRequest, friendRejectRequest, friendCancelRequest,
    removeFriend, blockUser, addFriendToAccount, removeFriendFromAccount,
    // useDebts
    debts, pendingDebtCount,
    // UI state
    interval, setInterval,
    customStart, setCustomStart,
    customEnd, setCustomEnd,
    timeCursorOffset, setTimeCursorOffset,
    intervalVisibility, setIntervalVisibility,
    intervalLabel,
    navigateInterval,
    viewModeOverride, setViewModeOverride,
    showAccountOverviewPicker, setShowAccountOverviewPicker,
    visibleTransactionsCount, setVisibleTransactionsCount,
    menuAccountsExpanded, setMenuAccountsExpanded,
    menuIncomeCatExpanded, setMenuIncomeCatExpanded,
    menuExpenseCatExpanded, setMenuExpenseCatExpanded,
    menuTagsExpanded, setMenuTagsExpanded,
    menuAccountsEditMode, setMenuAccountsEditMode,
    menuIncomeCatEditMode, setMenuIncomeCatEditMode,
    menuExpenseCatEditMode, setMenuExpenseCatEditMode,
    menuTagsEditMode, setMenuTagsEditMode,
    selectedCategoryFilter, setSelectedCategoryFilter,
    selectedTagFilter, setSelectedTagFilter,
    showOnlyTransfers, setShowOnlyTransfers,
    // Entry form
    entryType, setEntryType,
    entryAmount, setEntryAmount,
    entryDate, setEntryDate,
    entryCategoryId, setEntryCategoryId,
    entryNote, setEntryNote,
    entryTagIds, setEntryTagIds,
    newTagName, setNewTagName,
    noteFieldFocused, setNoteFieldFocused,
    // Category form
    categoryName, setCategoryName,
    categoryType, setCategoryType,
    categoryColor, setCategoryColor,
    categoryIcon, setCategoryIcon,
    categoryTagIds, setCategoryTagIds,
    // Tag form
    tagName, setTagName,
    tagColor, setTagColor,
    tagIcon, setTagIcon,
    // Account form
    newAccountName, setNewAccountName,
    newAccountCurrency, setNewAccountCurrency,
    newAccountIcon, setNewAccountIcon,
    accountTagIds, setAccountTagIds,
    settingsIncluded, setSettingsIncluded,
    settingsCarryOver, setSettingsCarryOver,
    settingsInitialBalance, setSettingsInitialBalance,
    settingsInitialDate, setSettingsInitialDate,
    // Invitation
    inviteToken, setInviteToken,
    joinToken, setJoinToken,
    invitationAccountId, setInvitationAccountId,
    inviteName, setInviteName,
    inviteExpiresDays, setInviteExpiresDays,
    managedInvites, setManagedInvites,
    // Transfer form
    transferFromId, setTransferFromId,
    transferToId, setTransferToId,
    transferSourceAmount, setTransferSourceAmount,
    transferRate, setTransferRate,
    transferTargetAmount, setTransferTargetAmount,
    transferDate, setTransferDate,
    transferNote, setTransferNote,
    // Icon/date picker
    showIconPickerSheet, setShowIconPickerSheet,
    iconPickerTarget, setIconPickerTarget,
    iconSearchQuery, setIconSearchQuery,
    showDatePicker, setShowDatePicker,
    datePickerTarget, setDatePickerTarget,
    dpYear, setDpYear,
    dpMonth, setDpMonth,
    showAcctPickerSheet, setShowAcctPickerSheet,
    acctPickerSheetTarget, setAcctPickerSheetTarget,
    // Display/layout
    sidebarTxCount, setSidebarTxCount,
    sidebarCategoryFilter, setSidebarCategoryFilter,
    showIntervalPicker, setShowIntervalPicker,
    overviewCollapsed, setOverviewCollapsed,
    spendingCollapsed, setSpendingCollapsed,
    categoriesCollapsed, setCategoriesCollapsed,
    scrollY, setScrollY,
    avatarImgError, setAvatarImgError,
    isCatPickerOpen, setIsCatPickerOpen,
    dragHighlightedCatId, setDragHighlightedCatId,
    // Refs
    mainScrollRef,
    noteInputRef,
    catPickerAnim,
    acctPickerAnim,
    iconPickerAnim,
    filterBarAnim,
    catCellMeasurements,
    catCellRefs,
    isCatPickerOpenRef,
    // Computed
    selectedAccount,
    entryAccount,
    selectedCurrency,
    selectedTags,
    selectedCategories,
    transferCategoryIds,
    entryCategories,
    entryTags,
    entryTagUsage,
    selectedTxs,
    recentCategoryAmounts,
    noteSuggestions,
    intervalBounds,
    filteredSelectedTxs,
    visibleSelectedTxs,
    hasMoreTransactions,
    selectedSummary,
    includedAccountIds,
    filteredIncludedTxs,
    sidebarFilteredTxs,
    accountsById,
    tagsById,
    categoriesById,
    includedAccountSummaries,
    totalIncludedSummary,
    totalIncludedBalance,
    overviewSummary,
    categorySpendData,
    allIncludedCategorySpendData,
    themeColor,
    filteredIconNames,
    categoryFilteredTxs,
    categoryFilteredTxsVisible,
    sortedSelectedCategories,
    selectedFilterCategory,
    filterIsExpense,
    // Actions
    formatCurrency,
    txDisplayLabel,
    handleDashboardScroll,
    cycleEntryAccount,
    appendNumpad,
    transferAppendNumpad,
    openDatePicker,
    openTransferDatePicker,
    openCatPicker,
    closeCatPicker,
    openAcctPickerSheet,
    closeAcctPickerSheet,
    openIconPickerSheet,
    closeIconPickerSheet,
    shareInvite,
    openEntryModal,
    openEntryModalWithAmount,
    openEditTransaction,
    openCreateAccount,
    openEditAccount,
    deleteAccount,
    saveCategory,
    deleteCategory,
    deleteTransaction,
    toggleCategoryHidden,
    cloneTempCategory,
    createTag,
    openCreateTag,
    openEditTag,
    saveTag,
    deleteTag,
    toggleTag,
    saveEntry,
    saveAccount,
    openTransfer,
    saveTransfer,
    loadManagedInvites,
    openInvitationsModal,
    saveInviteToken,
    removeInviteToken,
    joinByToken,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}

      {/* Global shared modals */}
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        entryDate={datePickerTarget === 'entry' ? entryDate : transferDate}
        setEntryDate={(date) => {
          if (datePickerTarget === 'entry') {
            setEntryDate(date);
          } else {
            setTransferDate(date);
          }
        }}
        dpYear={dpYear}
        setDpYear={setDpYear}
        dpMonth={dpMonth}
        setDpMonth={setDpMonth}
      />

      <AccountPickerSheet
        visible={showAcctPickerSheet}
        onClose={() => setShowAcctPickerSheet(false)}
        acctPickerAnim={acctPickerAnim}
        height={height}
        accounts={accounts}
        acctPickerSheetTarget={acctPickerSheetTarget}
        entryAccountId={entryAccountId}
        setEntryAccountId={setEntryAccountId}
        invitationAccountId={invitationAccountId}
        setInvitationAccountId={setInvitationAccountId}
        loadManagedInvites={loadManagedInvites}
        transferFromId={transferFromId}
        setTransferFromId={setTransferFromId}
        transferToId={transferToId}
        setTransferToId={setTransferToId}
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
    </DashboardContext.Provider>
  );
}
