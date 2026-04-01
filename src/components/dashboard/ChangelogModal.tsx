import React, { useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon from '../Icon';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

// ── Embedded content (backtick markers stripped from inline code) ──────────

const PATCHNOTES = `## [0.9.1] — 2026-03-31

### 🐛 Bug Fixes

#### Shared Account Access

- Root cause: saveAccount was creating accounts rows but not inserting account_members rows for creators. Under the current flat RLS architecture, all child tables (transactions, tags, account_settings) require EXISTS(account_members WHERE ...) with no fallback to created_by. This meant creators could see accounts but not their transactions/data, and sharing was incomplete.
- Fixed in client:
  - saveAccount now upserts creator as 'owner' member after account creation
  - joinByToken and addFriendToAccount now use upsert instead of insert (prevents 409 conflicts on re-join/re-add)
- Fixed with migration 20260401b_fix_shared_account_access.sql:
  - Backfilled missing creator membership rows for all existing accounts (ON CONFLICT DO NOTHING)
  - Added trg_auto_add_creator_member trigger to auto-insert creator as 'owner' member on every new account
  - Re-applied clean account_members RLS policies (terminal SELECT, permissive INSERT, self-only DELETE)

---

## [0.9.0] — 2026-03-31

### 🏗 Architecture

#### Cache-First Data Loading — TanStack Query

- Added @tanstack/react-query v5 as the data layer for all dashboard fetching
- QueryClientProvider wraps the app in App.tsx; global config: staleTime 5 min, gcTime 1 hr, refetchOnWindowFocus false
- Five new query hooks under src/hooks/:
  - useAccountsQuery — owned + shared accounts, user_preferences ordering
  - useTransactionsQuery — up to 1000 transactions enriched with transaction_tags
  - useCategoriesQuery — categories + user_hidden_categories in a single query
  - useTagsQuery — tags scoped by account set
  - useAccountSettingsQuery — settings with carry_over_balance column fallback
- All queries use stable, scoped keys so invalidation is always targeted
- setX wrappers in DashboardContext (setAccounts, setTransactions, setCategories, setTags, setAccountSettings) proxy to queryClient.setQueryData — all existing mutation callbacks work unchanged
- _sortedAccountKeyRef pattern prevents stale-closure bugs in setters when the account list changes mid-session
- hiddenCategoryIds local state re-syncs from the categories query on each dataUpdatedAt tick
- useDashboardData.ts refactored from a 439-line data-fetching hook into a ~100-line UI state layer
- reloadDashboard now calls queryClient.invalidateQueries on all 5 query keys in parallel
- joinByToken now calls scoped invalidateQueries instead of the old full loadData()
- loadData and hasLoadedOnceRef removed entirely from the codebase
- App reopen behavior: if data is < 5 minutes old, the dashboard renders instantly from cache with no loading spinner; a background refetch completes silently

### ✨ Features

#### Pull-to-Refresh

- Pull down on the main dashboard scroll view to silently refresh all data
- Uses RefreshControl on the root ScrollView in MainScrollView.tsx
- Independent local refreshing state — spinner stays visible until reloadDashboard() fully resolves; try/finally guarantees the spinner always dismisses
- Double-trigger prevention: pulling while already refreshing is a no-op
- Haptic feedback (expo-haptics ImpactFeedbackStyle.Medium) fires when pull starts (native only)
- Logo tap-to-refresh removed; DashboardHeader logo is now a static image

---

## [0.8.0] — 2026-03-30

### 🏗 Architecture

#### PoolScreen Refactor — 1024 Lines → Component Architecture

- PoolScreen.tsx reduced from 1024 lines to a ~120-line orchestration shell
- All pool UI extracted into dedicated components under src/components/pool/: PoolHeader, PoolSummaryCard, PoolMemberChips, PoolActions, TransactionList, TransactionModal, AddMemberModal, CreatePoolModal, PoolListContent, poolStyles.ts
- Pool state and computed values (poolMembers, poolTotal, perPerson, handleClosePool, handleSettlePool) extracted into src/hooks/usePool.ts
- Supabase queries remain exclusively in usePools.ts, usePoolTransactions.ts, and useDebts.ts — no direct DB calls in the screen or components

#### Settlement Domain Separation

- SettlementsScreen is now a pure read-only derivation view — it never writes pool transactions or manages pool membership
- Settlement flow changed from one-click auto-write to explicit compute → preview → commit:
  - Calculate Settlement — reads members + transactions, runs the greedy algorithm, returns PreTransaction[] with no DB write
  - Preview — shows each transfer (debtor → creditor, amount) before committing
  - Commit confirms and persists debts + closes pool; Discard clears the preview with no DB change
- PreTransaction type added to types/pools.ts
- computePoolSettlement() and commitPoolSettlement() added to useDebts.ts; settlePoolDebts() kept as a thin wrapper

#### Unified Pool Participant System

- New pool_participants table replaces pool_members, unifying auth users and external participants in a single table
- pool_transactions.paid_by now references pool_participants.id (was auth.users.id) — enables external payers
- Auth participants: type = 'auth', user_id set; External: type = 'external', external_name set
- pool_members table dropped after data migration (existing UUIDs preserved for FK remapping)
- Three SECURITY DEFINER RPCs: get_pool_members, add_pool_member, remove_pool_member (updated for new table)

### ✨ Features

#### External Pool Members

- Pool owners can now add participants who are not registered app users (by display name only)
- External members appear with purple chip styling in the member list
- External members can be selected as payer when adding or editing an expense
- Settlement algorithm includes external payers' contributions in the pool total but excludes them from the debt graph

### 🐛 Bug Fixes

#### Payer Selector Not Rendering

- The "paid by" chip row in the expense modal now renders with 1+ pool member (previously required 2+)

#### Transaction List Payer Lookup

- Payer display name in the transaction list now correctly resolves for both auth and external members

---

## [0.7.1] — 2026-03-30

### 🐛 Bug Fixes

#### Account Creation — No More Default Categories

- Creating a new account no longer seeds default categories. Categories are user-global and should only be created explicitly by the user.

#### Account Settings RLS — Owners Can Now Save Settings

- Saving account settings immediately after creating a new account no longer returns 403 Forbidden. RLS policy updated to allow the account owner (accounts.created_by) as well as members.

### 🔧 Technical

#### Database Cleanup — Baseline Migration

- All 26 incremental migration files consolidated into a single supabase/migrations/0000_baseline.sql
- Old migration files archived to supabase/migrations/archive/ (history preserved)
- New supabase/db/schema.md documents the final schema in human-readable form

---

## [0.7.0] — 2026-03-29

### 🏗 Architecture

#### DashboardScreen Refactor

- DashboardScreen.tsx reduced from ~2710 lines to a 10-line composition shell
- All state, effects, and callbacks extracted into src/context/DashboardContext.tsx
- UI sections extracted into independent Box components (OverviewCard, SpendingChart, CategoriesRow, TransactionSection) under src/components/dashboard/boxes/
- Layout components (DashboardLayout, DashboardHeader, DashboardBody, MainScrollView, DesktopSidebar, ScrollTopFab, BottomActions) under src/components/dashboard/layout/
- All modal/sheet components (ModalsRoot) read state from context — no prop drilling
- Zero behavior changes: all existing functionality, gestures, and interactions preserved

### ✨ UI / UX Improvements

#### Quick Navigation — Experimental Section

- Lending, Settlements, Pools, and Invitations are now grouped under a collapsible Experimental section
- The section is collapsed by default; tap "Experimental ⚗" to expand/collapse

#### Transaction Modal (Entry)

- Inline currency — Currency symbol now sits beside the amount (e.g. $123, €123, 123 Ft)
- Smarter header — Income/Expense toggle is now a single button in the modal header
- No duplicate close button — The ✕ icon in the top-left corner has been removed
- Tag chips improved — Tags now display their assigned icon and color directly on the chip
- Account icon in header — The account button in the modal header shows the account's icon
- Denser layout — Reduced padding on suggestion chips, tag chips, and the category button

#### Transfer Modal

- Consistent header — The Transfer modal now uses the same header style as the Entry modal

#### Category & Account Pickers

- Instant transitions — The category picker overlay and account picker sheet now appear and disappear instantly

### 🐛 Bug Fixes

#### Account Deletion

- Deleting an account now correctly removes the account row itself, not just its transactions

#### Category Delete (Web)

- Category delete now shows a confirmation dialog on web

#### Tag Delete (Quick Navigation)

- Deleting a tag from the Quick Navigation menu no longer closes the menu

#### Pool Creation & Loading (500 Error)

- Fixed circular Row Level Security policies on the pool_members table (infinite recursion)

#### Android Back Button

- The Android hardware back button now closes the topmost open modal or sheet

---

## [0.6.0] — 2026-03-27

### Features

- User-global categories (shared across all accounts, survive account deletion)
- Pools: shared expense pools with event/continuous types
- Settlements: unified screen for pools, debts, and balance
- Right sidebar on desktop: fixed All Accounts summary card, independent spending chart filter
- Quick Navigation: Lending, Settlements, Pools links with pending debt badge
- Targeted state updates — mutations update local state directly without full data refetch

---

## [0.5.0] — 2026-03-26

### Features

- Friends system: add by email, accept/reject/block requests, share accounts directly
- Avatar support (Google profile picture or initial fallback)
- Account sharing via friends (non-expiring, revocable)
- Transfer modal redesign with cross-currency support
- Icon picker with ~280 Lucide icons for accounts, categories, and tags
- PWA theme-color updates dynamically based on spending health
- Desktop sidebar with account summaries

---

## [0.4.0] — 2026-03-25

### Features

- Invite token system for sharing accounts
- Lending screen with debt confirmation and mark-paid flow
- Settlement algorithm (greedy debtor-creditor matching)
- Category icons and colors
- User preferences synced to Supabase (account order, primary account)

---

## [0.3.0] — 2026-03-24

### Features

- Transfer transactions with purple styling and ↔ indicator
- Category-based spending bar chart with tap-to-filter
- Overview mode: combined balance across all included accounts
- Per-account settings (include in balance, carry-over, initial balance)
- Custom date range filter

---

## [0.2.0] — 2026-03-23

### Features

- Multi-account support with currency selector
- Tag system with color support
- Numpad-based amount entry (avoids mobile keyboard)
- Desktop two-column layout at ≥ 1024px viewport

---

## [0.1.0] — 2026-03-22

### Initial release

- Google OAuth sign-in
- Income and expense transactions
- Category management
- Date interval filtering (Day, Week, Month, Year, All)
- React Native + Expo web PWA build`;

const README = `# Finduo

Financial tracking app for couples. Track income, expenses, and transfers across shared accounts with real-time sync, category-based spending insights, and cross-currency support.

---

## Tech Stack

- Frontend: React Native 0.83.2 + Expo SDK 55, TypeScript
- Web: react-native-web with PWA support (installable on Android/iOS)
- Backend: Supabase (PostgreSQL, Auth, Row Level Security)
- Auth: Google OAuth (PKCE flow)
- Icons: lucide-react-native (Material Symbol names mapped to Lucide components)

---

## Features

### Accounts

- Create multiple financial accounts with different currencies (USD, EUR, GBP, CAD, AUD, JPY, HUF)
- Per-account settings: include/exclude from balance overview, carry-over balance between intervals, initial balance with date
- Reorder accounts (persisted to Supabase per user)
- Set a primary account (persisted to Supabase per user)
- Desktop/mobile view toggle on web
- Account icons shown in quick navigation menu

### Transactions

- Add income and expense transactions with amount, date, category, note, and tags
- Display-only amount field with custom numpad (avoids keyboard on mobile)
- Currency symbol shown inline with the amount (e.g. $123, €123, 123 Ft)
- Custom calendar date picker for transaction date selection
- Transactions sorted by user-chosen date
- Recent amount suggestions based on history
- Infinite scroll with progressive loading (12 at a time)
- Amount text colored green (income) or red (expense)

### Transfers

- Dedicated transfer flow between accounts with currency conversion support
- Exchange rate or destination amount input for cross-currency transfers
- Transfer transactions use a "Transfer" category and are excluded from income/expense totals
- Transfers still affect net account balance

### Categories

- User-global categories shared across all accounts (not per-account)
- Categories are owned by users, not accounts — survive account deletion
- Connected users (sharing any account) see each other's categories automatically
- Per-user category hiding: hide categories you don't want without deleting them
- Categories have type (income/expense), color, and icon
- Category-based spending chart (horizontal bar chart with tap-to-filter)
- Tap a category chip to quickly add a transaction pre-filled with that category

### Tags

- Global tags with optional color and icon
- Tag chips in transaction entry modal show each tag's icon and color
- Attach tags to transactions, categories, and accounts
- Inline tag creation in the transaction entry modal

### Friends System

- Add other users as friends by email
- Mutual friend requests (send, accept, reject)
- Block users to prevent future requests
- Share accounts with friends directly — no token needed, no expiration
- Revoke friend access to accounts at any time

### Sharing & Invitations

- Share accounts with other users via invite tokens
- Token-based invite system: generate a token, share it, recipient pastes to join
- Configurable expiration (default 7 days)

### Pools

- Shared expense pools for splitting costs with friends
- Two pool types: Event (one-time trip, dinner) or Continuous (roommates, recurring)
- Pool creator can add registered app users (friends) or external participants by display name
- External members shown with purple chip styling; can be selected as payer on any expense
- All members can add and edit expenses; payer selector shows every participant (auth + external)
- Per-person split shown automatically (total / member count)
- Pool can be settled or closed

### Settlements & Lending

- Unified Settlements screen accessible from Quick Navigation menu
- Settlement uses a compute → preview → commit flow
- SettlementsScreen is read-only — pool management is done exclusively in PoolScreen
- Settlement algorithm: greedy debtor-creditor matching (equal split, minimum transfers)
- Debts require dual confirmation (from_user and to_user each confirm independently)
- Status flow: pending → confirmed (both sides confirmed) → paid

### Mobile UX

- Full-screen slide-up transaction modal
- Income/Expense type toggle in the modal header
- Swipe-to-select category picker (PanResponder-based)
- Cannot save a transaction without choosing a category (enforced in UI)
- Scroll-to-top floating action button
- Swipe from left edge to open Quick Navigation menu
- Android hardware back button closes the topmost open modal

### Desktop UX

- Two-column layout at viewport width >= 1024px
- Framed mobile preview mode (430px max-width with borders)
- Card-style modals with backdrop dismiss
- Right sidebar: fixed "All Accounts" summary card at top, scrollable content below

---

## Database Tables

- accounts — Financial accounts (name, currency, icon, created_by, tag_ids)
- account_members — User-account relationships for sharing (user_id, account_id, role)
- account_settings — Per-account config (included_in_balance, carry_over_balance, initial_balance)
- account_invites — Sharing tokens (token, name, invited_by, expires_at, used_at)
- categories — Transaction categories (name, type, color, icon, tag_ids); user-owned
- tags — Tags per account (name, color, icon)
- transactions — Financial transactions (account_id, category_id, amount, note, type, date)
- transaction_tags — Many-to-many join between transactions and tags
- user_preferences — Per-user prefs (account_order, primary_account_id, excluded_account_ids)
- user_hidden_categories — Per-user category hiding (user_id, category_id)
- user_profiles — Public user discovery (display_name, email, avatar_url)
- friends — Directional friend relationships (status: pending/accepted/rejected/blocked)
- pools — Shared expense pools (name, type: event/continuous, created_by, status)
- pool_participants — Unified pool membership: auth users and external participants
- pool_transactions — Pool expenses (pool_id, paid_by → pool_participants.id, amount)
- debts — Settlement debts (from_user, to_user, amount, pool_id, status)

---

## Project Structure

- App.tsx — Entry point: SafeAreaProvider > AuthProvider > RootNavigator
- src/components/dashboard/ — All dashboard modals and UI sections
- src/components/pool/ — All pool-specific UI components
- src/context/DashboardContext.tsx — All dashboard state + actions
- src/hooks/ — Data hooks (usePools, usePool, useDebts, useFriends, usePoolTransactions)
- src/lib/supabase.ts — Supabase client init
- src/screens/ — LoginScreen, DashboardScreen, PoolScreen, LendingScreen, SettlementsScreen
- src/types/ — TypeScript interfaces (dashboard, pools, friends, auth)
- supabase/migrations/ — Database schema and migrations

---

## Areas for Improvement

### Architecture
- [ ] Split DashboardContext into finer-grained hooks to reduce re-renders
- [ ] Create dedicated screens for account management, category management, settings

### Features
- [ ] Recurring transactions (subscriptions, salary, etc.)
- [ ] Budget limits per category with alerts
- [ ] Charts: pie chart for spending breakdown, line chart for trends
- [ ] Export data to CSV/PDF
- [ ] Multi-currency dashboard with base-currency conversion
- [ ] Push notifications for shared account activity
- [ ] Transaction search and advanced filtering
- [ ] Bulk transaction operations (multi-select, delete, re-categorize)
- [ ] Receipt photo attachment on transactions

### Technical
- [ ] Add unit tests and integration tests
- [ ] Add proper error boundaries
- [ ] Add offline support with sync queue
- [ ] Add Supabase realtime subscriptions for live updates between shared users`;

// ── Renderer ──────────────────────────────────────────────────────────────

type LineNode =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'h4'; text: string }
  | { type: 'bullet'; text: string; indent: number }
  | { type: 'hr' }
  | { type: 'spacer' }
  | { type: 'body'; text: string };

function parseLines(content: string): LineNode[] {
  return content.split('\n').map((line): LineNode => {
    if (line.startsWith('## ')) return { type: 'h2', text: line.slice(3) };
    if (line.startsWith('### ')) return { type: 'h3', text: line.slice(4) };
    if (line.startsWith('#### ')) return { type: 'h4', text: line.slice(5) };
    if (line === '---') return { type: 'hr' };
    if (line.trim() === '') return { type: 'spacer' };
    // Detect indented bullets (  - text)
    const indentedBullet = line.match(/^(\s+)- (.+)$/);
    if (indentedBullet) return { type: 'bullet', text: indentedBullet[2], indent: 2 };
    if (line.startsWith('- ')) return { type: 'bullet', text: line.slice(2), indent: 0 };
    return { type: 'body', text: line };
  });
}

function stripBold(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1');
}

function renderNode(node: LineNode, index: number): React.ReactNode {
  switch (node.type) {
    case 'h2':
      return <Text key={index} style={cs.h2}>{node.text}</Text>;
    case 'h3':
      return <Text key={index} style={cs.h3}>{node.text}</Text>;
    case 'h4':
      return <Text key={index} style={cs.h4}>{node.text}</Text>;
    case 'bullet':
      return (
        <View key={index} style={[cs.bulletRow, node.indent > 0 && cs.bulletIndented]}>
          <Text style={cs.bulletDot}>{node.indent > 0 ? '◦' : '•'}</Text>
          <Text style={cs.bulletText}>{stripBold(node.text)}</Text>
        </View>
      );
    case 'hr':
      return <View key={index} style={cs.hr} />;
    case 'spacer':
      return <View key={index} style={cs.spacer} />;
    case 'body':
      return node.text.trim() ? (
        <Text key={index} style={cs.body}>{stripBold(node.text)}</Text>
      ) : null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────

type ChangelogModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function ChangelogModal({ visible, onClose }: ChangelogModalProps) {
  const [view, setView] = useState<'patchnotes' | 'readme'>('patchnotes');
  const [scrollY, setScrollY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && screenWidth >= 1024;

  const nodes = parseLines(view === 'patchnotes' ? PATCHNOTES : README);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        {...uiProps(uiPath('changelog_modal', 'backdrop', 'container'))}
        style={[{ flex: 1 }, isWide && { backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }]}
      >
        {isWide && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              logUI(uiPath('changelog_modal', 'backdrop', 'container'), 'press');
              onClose();
            }}
          />
        )}
        <View
          {...uiProps(uiPath('changelog_modal', 'card', 'container'))}
          style={[
            cs.card,
            isWide && { width: 520, maxHeight: '88%' as any, borderRadius: 16, overflow: 'hidden' },
          ]}
        >
          {/* Header */}
          <View style={cs.header}>
            <Text style={cs.title}>
              {view === 'patchnotes' ? '📋 Patch Notes' : '📖 README'}
            </Text>
            <TouchableOpacity
              {...uiProps(uiPath('changelog_modal', 'header', 'toggle_button'))}
              style={cs.toggleBtn}
              onPress={() => {
                const next = view === 'patchnotes' ? 'readme' : 'patchnotes';
                logUI(uiPath('changelog_modal', 'header', 'toggle_button'), 'press');
                setView(next);
                setScrollY(0);
                scrollRef.current?.scrollTo({ y: 0, animated: false });
              }}
            >
              <Text style={cs.toggleBtnText}>
                {view === 'patchnotes' ? 'Show README' : 'Show Patch Notes'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={cs.scrollContent}
            scrollEventThrottle={16}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              setScrollY(e.nativeEvent.contentOffset.y);
            }}
          >
            {nodes.map((node, i) => renderNode(node, i))}
          </ScrollView>

          {/* Footer */}
          <View style={cs.footer}>
            <TouchableOpacity
              {...uiProps(uiPath('changelog_modal', 'footer', 'close_button'))}
              style={cs.closeBtn}
              onPress={() => {
                logUI(uiPath('changelog_modal', 'footer', 'close_button'), 'press');
                onClose();
              }}
            >
              <Text style={cs.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Scroll-to-top FAB — rendered last so it paints above footer */}
          {scrollY > 200 && (
            <TouchableOpacity
              {...uiProps(uiPath('changelog_modal', 'scroll_top_fab', 'button'))}
              style={cs.fab}
              onPress={() => {
                logUI(uiPath('changelog_modal', 'scroll_top_fab', 'button'), 'press');
                scrollRef.current?.scrollTo({ y: 0, animated: true });
              }}
            >
              <Icon name="arrow_up" size={20} color="#060A14" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#060A14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2F49',
  },
  title: {
    color: '#EDF5FF',
    fontSize: 17,
    fontWeight: '700',
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#13253B',
    borderWidth: 1,
    borderColor: '#2C4669',
  },
  toggleBtnText: {
    color: '#8FA8C9',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E2F49',
  },
  closeBtn: {
    backgroundColor: '#13253B',
    borderWidth: 1,
    borderColor: '#2C4669',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 14,
  },
  closeBtnText: {
    color: '#8FA8C9',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#53E3A6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  // Line renderers
  h2: {
    color: '#53E3A6',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  h3: {
    color: '#EDF5FF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 2,
  },
  h4: {
    color: '#8FA8C9',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginVertical: 2,
  },
  bulletIndented: {
    paddingLeft: 16,
  },
  bulletDot: {
    color: '#53E3A6',
    fontSize: 13,
    lineHeight: 20,
    width: 10,
  },
  bulletText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
  },
  hr: {
    height: 1,
    backgroundColor: '#1E2F49',
    marginVertical: 12,
  },
  spacer: {
    height: 4,
  },
  body: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    marginVertical: 1,
  },
});
