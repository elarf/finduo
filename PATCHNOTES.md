# Finduo – Patch Notes

<!-- markdownlint-disable MD013 MD024 -->

---

## [1.0.2] — 2026-04-01

### 🐛 Bug Fixes

#### Production RLS — Friends, Profiles, and Shared Accounts Restored

- **Root cause:** Multiple RLS policies were missing on production — 6 tables had RLS enabled with zero policies, making all queries return empty or fail silently. Additionally, the `account_members` SELECT policy was self-referential, causing `42P17 infinite recursion` errors on every account-related query after a schema cache reload.
- **Tables restored** (0 policies → full coverage):
  - `friends` — friends list was completely empty
  - `user_profiles` — all user names and avatars were invisible
  - `user_preferences` — account ordering and primary account selection lost
  - `user_hidden_categories` — hidden categories did not persist
  - `account_invites` — invite link system was non-functional
  - `transaction_tags` — tags on transactions were invisible
- **`account_members` infinite recursion fixed** — replaced self-referential SELECT policy with terminal `user_id = auth.uid()` policy; co-member visibility handled via SECURITY DEFINER RPCs
- **Account sharing rewritten as RPCs** — `share_account` and `unshare_account` SECURITY DEFINER functions bypass cross-table RLS evaluation issues that blocked `.upsert()` on `account_members`
- **Friend account map** — `get_friend_account_memberships` RPC replaces direct `account_members` query (which was blocked by terminal SELECT policy) to show which accounts are shared with which friends

#### Schema Additions Applied to Production

- `contacts` table created with full RLS (was missing from production)
- `pool_members` columns added: `type`, `external_name`, `contact_id`, `created_at`
- `debts` columns added: `from_participant_id`, `to_participant_id`, `from_participant_name`, `to_participant_name`, `from_contact_id`, `to_contact_id`
- `get_pool_members` RPC updated: returns contact data via JOIN
- `add_pool_member` RPC updated: accepts `p_contact_id` parameter
- `account_settings` INSERT/DELETE policies added (only had SELECT/UPDATE)
- `is_account_member` function upgraded to SECURITY DEFINER

### 🔧 Technical

- `useFriends.ts` — account sharing now uses `share_account`/`unshare_account` RPCs instead of direct `.upsert()`/`.delete()` on `account_members`
- `useFriends.ts` — friend account map loading now uses `get_friend_account_memberships` RPC instead of direct `account_members` query
- Migration: `supabase/migrations/20260401e_production_full_fix.sql`

---

## [1.0.1] — 2026-04-01

### 🐛 Bug Fixes

#### ChangelogModal — HTML Comment & HR Noise Stripping

- `sanitizeContent` added to `ChangelogModal.tsx`: strips HTML comments (`<!-- ... -->`) and blank `---` separator lines before parsing fetched markdown
- Prevents stray comment blocks and unwanted horizontal rules from rendering as layout noise in the modal
- Fetch chain updated: `.then((text) => setContent(sanitizeContent(text)))` instead of `.then(setContent)`

### 🔧 Technical

#### Migration Cleanup — Clean RLS Baseline

- Archived 9 outdated/conflicting migration files from `supabase/migrations/` to `archive/migrations/`
  - `20260330a` through `20260330f` — iterative RLS recursion fixes, each superseding the previous
  - `20260401b_fix_shared_account_access.sql` — rolled into new baseline
  - `20260401b_debts_external_participants.sql` — rolled into new baseline
  - `02_clean_rls.sql` — referenced non-existent tables (`pool_members` post-drop, `recurring`, `pool_expenses`, `pool_settlements`, `pool_debts`)
- New `supabase/migrations/20260401c_clean_rls_baseline.sql` is the authoritative RLS source:
  - Drops all known policy names before recreating (idempotent)
  - **Pool full-trust model**: any pool member can `INSERT`, `UPDATE`, `DELETE` pool transactions (was incorrectly restricted to `paid_by = auth.uid()` or owner only)
  - **Account UPDATE**: restricted to owner only (members have read access only, per spec)
  - All policies use flat `EXISTS` subqueries — no SECURITY DEFINER functions in policy expressions except `get_connected_user_ids()` for category co-member visibility
  - Stale functions dropped: `get_my_account_ids()`, `get_my_member_account_ids()`, `is_account_creator()`
  - Creator backfill + `trg_auto_add_creator_member` trigger rolled in
  - `debts` participant columns (`from_participant_id`, `to_participant_id`, etc.) added via `ADD COLUMN IF NOT EXISTS`

---

## [1.0.0] — 2026-04-01

### 🔍 Architecture

#### Full DevTools Tracing

- Added `src/lib/devtools.ts` with `uiPath`, `uiProps`, `logUI`, `logAPI`, and `webAlert` utilities
- Every meaningful UI element across all screens, modals, and components has a stable `testID` / `data-ui` attribute using the `screen.component.element[#id]` naming scheme
- `logUI(path, event?)` and `logAPI(url, meta)` emit `[UI]` / `[API]` prefixed `console.debug` messages for all interactions and network calls
- `EXPO_PUBLIC_DEBUG_UI=true` renders green dashed outlines on all instrumented elements (web only)
- All 11 dashboard modals, all layout components, all pool components, and all screens instrumented

### ✨ Features

#### Pool Deletion

- Pool creators can now delete a pool via an edit toggle (pencil icon) in the pool header
- Deletion requires confirmation dialog (cross-platform: `window.confirm` on web, `Alert.alert` on native)
- Edit mode reveals the delete button; settle and close buttons are hidden while in edit mode

#### Pool Settle — Single-Member & External-Member Support

- Settle now works with 1-member pools and with auth + external member combinations
- In these cases, all spendings are aggregated into a net `PreTransaction` shown as a banner with an "Add as transaction" button that opens the entry modal pre-filled with the amount
- `SettleResult` union type discriminates `settled`, `balanced`, `entry`, and `error` outcomes to drive post-confirm navigation

#### Numpad Enhancements

- Added decimal dot (`.`), double-zero (`00`), and triple-zero (`000`) keys to the entry modal numpad
- New bottom two rows: `. 0 00` / `C 000 ←`
- Enables fast large-number entry (e.g. `1000` in two taps) and precise decimal amounts

#### Changelogs (Experimental)

- New **Changelogs** item in the Experimental section of Quick Navigation
- Opens a full-screen modal displaying PATCHNOTES.md content with a toggle to switch to README.md view
- Scroll-to-top FAB appears when scrolled past 200 px; view toggle resets scroll position

### 🗂 Navigation

#### Pools Promoted from Experimental

- Pools link moved from the collapsible Experimental section to the main Quick Navigation menu
- Positioned above the Friends link for quick access

### 🐛 Bug Fixes

#### `Alert.alert` No-Op on Web

- All user-facing feedback that relied on `Alert.alert` now uses cross-platform `webAlert` (`window.alert` on web, `Alert.alert` on native)
- `confirmDialog` inside `usePool` now uses `window.confirm` on web for all destructive actions (pool delete, pool close, pool settle)

#### Pool Transaction FK Violation (External Payer)

- Adding a pool transaction with an external (non-auth) pool member as payer no longer throws a `23503` FK constraint error
- `TransactionModal` always uses `pool_member.id` (participant UUID) instead of `user_id` as the `paid_by` value
- DB migration: drop `pool_transactions_paid_by_fkey`, migrate existing rows, re-add FK referencing `pool_members(id)`

#### Pool Close Navigation

- `closePool` returns `Promise<boolean>`; navigation away from the pool only triggers on confirmed success (no silent no-op on error)

---

## [0.9.1] — 2026-03-31

### 🐛 Bug Fixes

#### Shared Account Access (Sharing with friends doesn't work anymore)

- **Root cause:** `saveAccount` was creating `accounts` rows but not inserting `account_members` rows for creators. Under the current flat RLS architecture, all child tables (`transactions`, `tags`, `account_settings`) require `EXISTS(account_members WHERE ...)` with no fallback to `created_by`. This meant creators could see accounts but not their transactions/data, and sharing was incomplete.
- **Fixed in client:**
  - `saveAccount` now upserts creator as `'owner'` member after account creation
  - `joinByToken` and `addFriendToAccount` now use upsert instead of insert (prevents 409 conflicts on re-join/re-add)
- **Fixed with migration `20260401b_fix_shared_account_access.sql`:**
  - Backfilled missing creator membership rows for all existing accounts (`ON CONFLICT DO NOTHING`)
  - Added `trg_auto_add_creator_member` trigger to auto-insert creator as `'owner'` member on every new account (belt-and-suspenders DB guarantee)
  - Re-applied clean account_members RLS policies (terminal SELECT, permissive INSERT, self-only DELETE)

---

## [0.9.0] — 2026-03-31

### 🏗 Architecture

#### Cache-First Data Loading — TanStack Query

- Added `@tanstack/react-query` v5 as the data layer for all dashboard fetching
- `QueryClientProvider` wraps the app in `App.tsx`; global config: `staleTime: 5 min`, `gcTime: 1 hr`, `refetchOnWindowFocus: false`
- Five new query hooks under `src/hooks/`:
  - `useAccountsQuery` — owned + shared accounts, user_preferences ordering
  - `useTransactionsQuery` — up to 1000 transactions enriched with `transaction_tags`
  - `useCategoriesQuery` — categories + `user_hidden_categories` in a single query
  - `useTagsQuery` — tags scoped by account set
  - `useAccountSettingsQuery` — settings with `carry_over_balance` column fallback
- All queries use stable, scoped keys (e.g. `['transactions', sortedAccountKey]`) so invalidation is always targeted
- `setX` wrappers in `DashboardContext` (`setAccounts`, `setTransactions`, `setCategories`, `setTags`, `setAccountSettings`) proxy to `queryClient.setQueryData` — all existing mutation callbacks work unchanged
- `_sortedAccountKeyRef` pattern prevents stale-closure bugs in setters when the account list changes mid-session
- `hiddenCategoryIds` local state re-syncs from the categories query on each `dataUpdatedAt` tick
- `useDashboardData.ts` refactored from a 439-line data-fetching hook into a ~100-line UI state layer (selection, animation, saving flags, refs)
- `reloadDashboard` now calls `queryClient.invalidateQueries` on all 5 query keys in parallel
- `joinByToken` now calls scoped `invalidateQueries` instead of the old full `loadData()`
- `loadData` and `hasLoadedOnceRef` removed entirely from the codebase
- **App reopen behavior:** if data is < 5 minutes old, the dashboard renders instantly from cache with no loading spinner; a background refetch completes silently

### ✨ Features

#### Pull-to-Refresh

- Pull down on the main dashboard scroll view to silently refresh all data
- Uses `RefreshControl` on the root `ScrollView` in `MainScrollView.tsx`
- Independent local `refreshing` state (`useState`) — spinner stays visible until `reloadDashboard()` fully resolves; `try/finally` guarantees the spinner always dismisses
- Double-trigger prevention: pulling while already refreshing is a no-op
- Haptic feedback (`expo-haptics` `ImpactFeedbackStyle.Medium`) fires when pull starts (native only)
- Logo tap-to-refresh removed; `DashboardHeader` logo is now a static image

---

## [0.8.0] — 2026-03-30

### 🏗 Architecture

#### PoolScreen Refactor — 1024 Lines → Component Architecture

- `PoolScreen.tsx` reduced from 1024 lines to a ~120-line orchestration shell
- All pool UI extracted into dedicated components under `src/components/pool/`: `PoolHeader`, `PoolSummaryCard`, `PoolMemberChips`, `PoolActions`, `TransactionList`, `TransactionModal`, `AddMemberModal`, `CreatePoolModal`, `PoolListContent`, `poolStyles.ts`
- Pool state and computed values (`poolMembers`, `poolTotal`, `perPerson`, `handleClosePool`, `handleSettlePool`) extracted into `src/hooks/usePool.ts`
- Supabase queries remain exclusively in `usePools.ts`, `usePoolTransactions.ts`, and `useDebts.ts` — no direct DB calls in the screen or components

#### Settlement Domain Separation

- `SettlementsScreen` is now a pure **read-only derivation** view — it never writes pool transactions or manages pool membership
- Settlement flow changed from one-click auto-write to explicit **compute → preview → commit**:
  1. **Calculate Settlement** — reads members + transactions, runs the greedy algorithm, returns `PreTransaction[]` with no DB write
  2. **Preview** — shows each transfer (debtor → creditor, amount) before committing
  3. **Commit** confirms and persists debts + closes pool; **Discard** clears the preview with no DB change
- `PreTransaction` type added to `types/pools.ts`: `{ fromParticipantId, toParticipantId, amount, metadata: { reason, sourcePoolId } }`
- `computePoolSettlement()` and `commitPoolSettlement()` added to `useDebts.ts`; `settlePoolDebts()` kept as a thin wrapper for PoolScreen's one-step Settle button

#### Unified Pool Participant System (DB Migration: `20260401_unified_pool_participants.sql`)

- New `pool_participants` table replaces `pool_members`, unifying auth users and external (manually added) participants in a single table
- `pool_transactions.paid_by` now references `pool_participants.id` (was `auth.users.id`) — enables external payers
- Auth participants: `type = 'auth'`, `user_id` set; External: `type = 'external'`, `external_name` set; display_name denormalized for UI
- `pool_members` table dropped after data migration (existing UUIDs preserved for FK remapping)
- Final FK graph is a strict DAG: `auth.users ← pool_participants.user_id (RESTRICT)`, `pool_participants ← pool_transactions.paid_by (RESTRICT)`, no cascades that race with restricts
- FK constraints removed from `pools.created_by`, `debts.from_user`, `debts.to_user` — stored as plain UUID; RLS value-comparisons (`= auth.uid()`) unaffected
- Three SECURITY DEFINER RPCs: `get_pool_members`, `add_pool_member`, `remove_pool_member` (updated for new table)

### ✨ Features

#### External Pool Members

- Pool owners can now add participants who are not registered app users (by display name only)
- External members appear with purple chip styling in the member list
- External members can be selected as payer when adding or editing an expense
- Settlement algorithm includes external payers' contributions in the pool total but excludes them from the debt graph (debts are between auth users only)

### 🐛 Bug Fixes

#### Payer Selector Not Rendering

- The "paid by" chip row in the expense modal now renders with 1+ pool member (previously required 2+ registered members, hiding it in single-member test pools)

#### Transaction List Payer Lookup

- Payer display name in the transaction list now correctly resolves for both auth and external members (lookup matches `m.user_id === paid_by` OR `m.id === paid_by`)

---

## [0.7.1] — 2026-03-30

### 🐛 Bug Fixes

#### Account Creation — No More Default Categories

- Creating a new account no longer seeds default categories. Categories are user-global and should only be created explicitly by the user. Any database trigger that auto-seeded categories on account insert has been dropped.

#### Account Settings RLS — Owners Can Now Save Settings

- Saving account settings (carry-over, initial balance, include in balance) immediately after creating a new account no longer returns `403 Forbidden`. The RLS policy on `account_settings` previously only allowed access for users already in `account_members`, but the creator may not have a membership row yet. Policy updated to allow the account owner (`accounts.created_by`) as well as members.

### 🔧 Technical

#### Database Cleanup — Baseline Migration

- All 26 incremental migration files consolidated into a single `supabase/migrations/0000_baseline.sql` that recreates the full schema from scratch (16 tables, indexes, RLS policies, SECURITY DEFINER functions, grants).
- Old migration files archived to `supabase/migrations/archive/` (history preserved).
- New `supabase/db/schema.md` documents the final schema in human-readable form (tables, columns, types, constraints, relationships, RLS summaries).

---

## [0.7.0] — 2026-03-29

### 🏗 Architecture

#### DashboardScreen Refactor

- `DashboardScreen.tsx` reduced from ~2710 lines to a 10-line composition shell (`<DashboardProvider><DashboardLayout /></DashboardProvider>`)
- All state, effects, and callbacks extracted into `src/context/DashboardContext.tsx` (`DashboardProvider` + `useDashboard()` hook)
- UI sections extracted into independent Box components (`OverviewCard`, `SpendingChart`, `CategoriesRow`, `TransactionSection`) under `src/components/dashboard/boxes/`
- Layout components (`DashboardLayout`, `DashboardHeader`, `DashboardBody`, `MainScrollView`, `DesktopSidebar`, `ScrollTopFab`, `BottomActions`) under `src/components/dashboard/layout/`
- All modal/sheet components (`ModalsRoot`) read state from context — no prop drilling
- Zero behavior changes: all existing functionality, gestures, and interactions preserved

### ✨ UI / UX Improvements

#### Quick Navigation — Experimental Section

- Lending, Settlements, Pools, and Invitations are now grouped under a collapsible **Experimental** section
- The section is collapsed by default; tap "Experimental ⚗" to expand/collapse
- Friends remains a direct top-level link
- New menu order: Friends → Experimental → Reload app → Sign out

#### Transaction Modal (Entry)

- **Inline currency** — Currency symbol now sits beside the amount (e.g. `$123`, `€123`, `123 Ft`). The separate currency line below the amount is gone.
- **Smarter header** — Income/Expense toggle is now a single button in the modal header. Tap it to switch type. The button color updates live: green for Income, red for Expense.
- **No duplicate close button** — The ✕ icon in the top-left corner has been removed. The Cancel button in the bottom bar is the only way to dismiss (consistent, less clutter).
- **Tag chips improved** — Tags now display their assigned icon and color directly on the chip. Selected tags show a tinted background so the active state is immediately obvious.
- **Account icon in header** — The account button in the modal header shows the account's icon (if set) alongside the name.
- **Denser layout** — Reduced padding on suggestion chips, tag chips, and the category button. More content fits on screen without feeling cramped.

#### Transfer Modal

- **Consistent header** — The Transfer modal now uses the same header style as the Entry modal: a single "Transfer" badge with purple accent, no close button, same button shape and size as Income/Expense.

#### Category & Account Pickers

- **Instant transitions** — The category picker overlay and account picker sheet now appear and disappear instantly (no slide animation delay).

#### Loading Screen

- Logo now fills the full width of the screen instead of being constrained to 80%.

### 🐛 Bug Fixes

#### Account Deletion

- Deleting an account now correctly removes the account row itself, not just its transactions. Previously the account record would stay in the database due to a Row Level Security conflict. Fixed with a server-side function that bypasses RLS for the account owner.

#### Category Delete (Web)

- Category delete in the modal and Quick Navigation now shows a confirmation dialog on web (previously no confirmation appeared and the delete silently failed).

#### Tag Delete (Quick Navigation)

- Deleting a tag from the Quick Navigation menu no longer closes the menu. The tag disappears from the list once deletion completes — the menu stays open.

#### Pool Creation & Loading (500 Error)

- Creating a new pool or loading pool members no longer returns a 500 Internal Server Error. Root cause: circular Row Level Security policies on the `pool_members` table caused infinite recursion. Fixed by restructuring all pool-related RLS policies to eliminate the cycle.

#### Android Back Button

- The Android hardware back button now closes the topmost open modal or sheet. Previously it would navigate back or exit the app entirely. If no modal is open, the back button is absorbed — the dashboard stays visible.

### 🔧 Technical

- New SQL migrations for account deletion (`delete_own_account` SECURITY DEFINER function) and pool RLS fixes.
- Pool member lookup switched from direct table SELECT to a SECURITY DEFINER RPC function (`get_pool_members`) to work around the RLS restructure.
- Fixed missing `AccountSetting` type import in DashboardScreen.

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
- React Native + Expo web PWA build
