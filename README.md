# Finduo

<!-- markdownlint-disable MD013 MD024 -->

Financial tracking app for couples and shared households. Track income, expenses, and transfers across multiple accounts with real-time sync, category-based spending insights, shared expense pools, and cross-currency support.

---

## Latest Release — v1.1.0

- **FinBiome** — 3D financial visualization in WebGL displaying all accounts as trees in a forest layout
- **Forest view** — accounts appear as separate trees with auto-rotating orbital camera
- **Access methods** — mobile: swipe avatar rightward to spinner; desktop: tree icon button in header; both: FinBiome button in Quick Navigation menu
- **Debug overlay** — real-time data counts and scene parameters shown in glassmorphic panel
- **Built with Three.js 0.140** — plain WebGL for React 19 compatibility (no React wrapper)

Full history: [PATCHNOTES.md](./PATCHNOTES.md)

---

## Tech Stack

- **Frontend:** React Native 0.83.2 + Expo SDK 55, TypeScript
- **Web:** react-native-web with PWA support (installable on Android and iOS)
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security)
- **Auth:** Google OAuth (PKCE flow)
- **Data layer:** TanStack Query v5 (cache-first, 5 min stale time, 1 hr gc)
- **Icons:** lucide-react-native (all ~1,900 icons available in picker)
- **DevTools:** `src/lib/devtools.ts` — stable `testID`/`data-ui` attributes, console tracing, debug overlay

---

## Features

### Transactions

- Add income and expense transactions with amount, date, category, note, and tags
- Display-only amount field with a custom numpad (avoids the mobile keyboard)
- Numpad layout: `7 8 9` / `4 5 6` / `1 2 3` / `. 0 00` / `C 000 ←` — supports fast large-number and precise decimal entry
- Currency symbol shown inline with the amount (e.g. $123, €123, 123 Ft)
- Custom calendar date picker; transactions sorted by user-chosen date
- Recent amount suggestions based on transaction history
- Infinite scroll with progressive loading (12 at a time)
- Amount text colored green for income, red for expense
- Transaction list shows tag icons and colors inline, followed by note text
- If no note is provided, tag names are shown as the title; if both are absent, a fallback text is shown
- Edit and delete transactions inline from the list

### Transfers

- Dedicated transfer flow between any two accounts owned or shared by the user
- Cross-currency support: enter the exchange rate or the destination amount directly
- Transfer transactions use a global system "Transfer" category (shared by all users, not editable or deletable)
- Transfers are excluded from income/expense totals but still affect net account balance
- Transfer entries display with a `↔` indicator and the `Replace` icon

### Categories

- User-global categories shared across all accounts (not per-account)
- Categories survive account deletion — they belong to users, not accounts
- Connected users (sharing any account) see each other's categories automatically
- Per-user category hiding: hide categories without deleting them; other users are unaffected
- Categories have type (income/expense), optional color, and optional icon
- A friend's categories are read-only (use but cannot edit or delete)
- Income and Expense category sections shown as separate collapsible groups in Quick Navigation
- Icon picker with all ~1,900 Lucide icons; lazy-loaded 60 per page, search returns all matches instantly
- Icon auto-suggested based on category name keywords
- Category-based horizontal spending bar chart with tap-to-filter
- Tap a category chip to quickly open the entry modal pre-filled with that category

### Tags

- Global tags with optional color and icon
- Attach tags to transactions; filter the transaction list by tag
- Tag chips in the transaction entry modal show each tag's icon and color; selected state uses background contrast
- Inline tag creation inside the transaction entry modal
- Tag delete from Quick Navigation keeps the menu open

### Accounts

- Create multiple financial accounts with different currencies (USD, EUR, GBP, CAD, AUD, JPY, HUF)
- Per-account settings: include or exclude from the balance overview, carry-over balance between intervals, initial balance with a start date
- Reorder accounts in Quick Navigation (order persisted to Supabase per user)
- Set a primary account (persisted per user)
- Account icons shown in Quick Navigation when not in edit mode
- Share accounts with friends directly (no token required, non-expiring, revocable)
- Invite other users to an account via time-limited tokens

### Friends System

- Add other registered users as friends by email address
- Mutual friend requests: send, accept, reject, or block
- Blocked users cannot see the relationship or send new requests
- Expand a friend in the Friends modal to manage which accounts they have access to
- Share any owned account with a friend — access is non-expiring and revocable at any time
- Friend list shows profile pictures (Google avatar snapshotted to Supabase Storage, or initial fallback) and the count of shared accounts

### Sharing & Invitations

- Generate invite tokens for any owned account with a configurable expiration (default 7 days)
- Named invites for tracking who was invited
- Token recipients paste the token to join the account instantly
- Shared accounts appear alongside owned accounts in all views

### Pools

Pools are shared expense pools for splitting costs among a group.

- Two pool types: **Event** (one-time, e.g. a trip or dinner) and **Continuous** (recurring, e.g. roommates)
- Pool creator can add registered app users (from their friend list) or external participants by display name
- External members shown with purple chip styling; can be selected as the payer on any expense
- All pool members can add and edit expenses; the payer selector shows every participant (auth and external)
- Per-person split shown automatically (total ÷ member count)
- Settlement flow: **Calculate** (greedy algorithm, no DB write) → **Preview** (see each transfer: who owes whom and how much) → **Commit** (persists debts and closes pool) or **Discard** (no DB change)
- Settlement excludes external participants from the debt graph (their payments still count toward the total)
- Only the pool creator can commit a settlement, preventing duplicate debt rows from concurrent commits
- Pool creator can close an event pool (sets `status: closed` and `end_date`; disables adding expenses and members)
- Pool creator can delete the pool (confirmation required via dialog)
- RLS ensures users can only see pools they are members of; the member list is exposed via a SECURITY DEFINER RPC

### Contacts (FinOps)

Accessible from the FinOps section in Quick Navigation.

- Unified contact list merging pool participants and accepted friends into one view
- Friend-linked contacts show the friend's profile picture (with initial fallback if the image fails to load)
- App user contacts (linked to a registered account) show email as read-only — email is sourced from the authentication record and cannot be changed here
- Edit display name, phone, and notes for any contact; add new manual contacts from within the section

### Lending (FinOps)

Accessible from the FinOps section in Quick Navigation.

- Net balance card shows the overall debt position at a glance (positive = others owe you, negative = you owe others)
- **Pending** — debts the current user has not yet confirmed; a **Confirm** button registers your side of the two-sided confirmation
- **Ready to record** — debts where the current user has confirmed (or both sides have confirmed); a green **Record** button pre-fills the Dashboard entry modal with the correct type, amount, and note, and marks the debt as recorded
- **Recorded** — debts that have been converted to a Dashboard transaction; an **Archive** button moves them to the Archived section
- **Archived** — collapsed by default; expand by tapping the header; archived debts show a **Record** button to re-record in case the Dashboard entry was deleted by accident
- Broken debts (missing or "Unknown" counterpart name) are shown in italic grey with a **broken** badge and a red delete button — record/archive actions are suppressed for unresolvable entries

### Settlements (FinOps)

Accessible from the FinOps section in Quick Navigation.

- **Debts section** (accordion, starts collapsed): Pending, Ready to record, Paid sub-sections; same confirm and Record actions as Lending
- **Pools section** (accordion, starts expanded): browse all pools you belong to; expand any pool row to auto-calculate its settlement plan inline
- Committed (closed) pools show an X/Y auth-members-confirmed banner and per-transfer "Record" buttons
- `SettlementsScreen` is read-only — pool management (create, add expense, add member, close, delete) is done exclusively in PoolScreen
- Settlement algorithm: greedy debtor-creditor matching for minimum number of transfers

### Overview Mode

- Tap the balance card header to toggle between single-account and all-included-accounts overview
- Overview totals combine balance, income, and expenses across all non-excluded accounts
- Transaction list switches to show all included-account transactions with per-transaction account badges
- Spending chart aggregates across all included accounts
- Categories row and bottom action buttons are hidden in overview mode

### FinBiome

3D WebGL visualization system that transforms financial data into a living ecosystem.

- **FinForest**: All account trees displayed side-by-side in 3D space
  - Account spheres at tree roots (size based on absolute value, glowing cyan)
  - Category cubes as branches (color from category, emissive glow)
  - Transaction spheres as leaves (small, colored by transaction type)
  - Lines connecting nodes to show hierarchical relationships
- **Auto-rotating orbital camera** for ambient exploration of the financial forest
- **Data transformation layer** converts accounts → categories → transactions into hierarchical 3D node structures
- **Access methods**:
  - Mobile web: Swipe avatar rightward to spinner (~50% screen width) as premium gesture
  - Desktop web: Tree icon button in dashboard header (replaces view toggle)
  - Quick Navigation: FinBiome button (cyan tree icon) above FinOps section
- **Debug overlay**: Real-time display of account count, category count, transaction count, and forest layout positions
- **Platform support**: Web-only (mobile and desktop); native shows "FinBiome is available on web" fallback
- **Built with Three.js 0.140** using manual scene management for React 19 compatibility (no React wrappers)

### Date Filtering

- Interval options: Day, Week, Month, Year, All, Custom
- Custom range with start and end date inputs
- Opening balance computed from pre-interval transactions when carry-over is enabled
- Balance carry-over respects interval boundaries per account setting

### Balance Card

- Income total colored green, expense total colored red
- Opening balance and net balance colored by sign (green if ≥ 0, red if < 0)
- Tap the balance card header to enter Overview mode

### Quick Navigation Menu

Swipe from the left edge (20 px zone) or tap the avatar to open.

- **Version badge** — top-right of the panel header; fetches the latest `package.json` from GitHub on open; turns green with a `v1.0.3 → v1.0.4` style indicator when an update is available; tap to open ChangelogModal
- **Accounts** — expand to see all accounts with icon, currency, and inclusion status; edit mode reveals reorder arrows, primary toggle, include/exclude toggle, edit and delete buttons
- **Income** — expand to see income categories; tap to pre-fill an income transaction; edit mode adds hide, edit, delete buttons
- **Expense** — expand to see expense categories; same tap and edit behaviour as Income
- **↔ Transfers** — tap to filter the transaction list to transfers only
- **Tags** — expand to see all tags; tap a tag to filter the transaction list; edit mode adds edit and delete buttons
- **FinBiome** — opens the 3D financial visualization screen (web-only); displays accounts as trees in a forest layout with auto-rotating camera
- **FinOps** (collapsible, shows pending debt badge when collapsed):
  - **Pools** — opens as an embedded section inside the Dashboard; a ContextBar labels the view; `+` in the bar opens the create-pool modal
  - **Lending** — opens as an embedded section; shows pending debt count badge
  - **Settlements** — opens as an embedded section inside the Dashboard
  - **Contacts** — opens as an embedded section; unified list of pool contacts and friends; edit/add contacts
- **Friends** — opens the Friends modal
- **Settings** (collapsible):
  - **Invitations** — opens the Invitations modal
  - **Changelogs** — opens ChangelogModal (PATCHNOTES.md + README.md viewer with scroll-to-top FAB)
  - **Visible Intervals** — toggle which interval options are shown (Day, Week, Month, Year, All, Custom); selection persisted to `localStorage` across sessions
  - **Reload app** — on web: unregisters service worker, clears all caches, reloads; on native: invalidates all queries
  - **Sign out** — ends the session

### Header

- Centered logo (static image)
- Avatar button (top-left) opens Quick Navigation; shows Google profile picture or email-initial fallback
- View-mode toggle button (top-right, desktop only) switches between desktop and mobile layout
- Spinner (top-right, mobile only) — always visible; tap to reload all dashboard data in the background; swaps to `spinnerFAST.gif` while loading; dashboard skeleton stays visible throughout

### Mobile UX

- Full-screen slide-up transaction modal: date → amount (inline currency) → note → tags → numpad → category → save/cancel
- Income/Expense type toggle is a single button in the modal header; color updates live (green/red)
- Cancel button in the modal bottom bar is the only dismiss path (no redundant close button)
- Swipe-to-select category picker: press "Choose Category" and drag to a category without lifting the finger
- Category picker also works as a regular tappable grid
- Cannot save a transaction without selecting a category (enforced in the UI)
- Scroll-to-top floating action button appears when scrolled past 320 px
- Swipe from the left edge (20 px zone) to open Quick Navigation
- Pull-to-refresh on the main scroll view (haptic feedback on native) — independent spinner that always dismisses via `try/finally`
- Android hardware back button closes the topmost open modal or sheet; never exits the app unexpectedly

### Desktop UX

- Two-column layout at viewport width ≥ 1024 px
- Left column: framed mobile-style dashboard (max 430 px)
- Right sidebar: fixed "All Accounts" summary card at the top; scrollable content; independent spending chart with tap-to-filter (category filter in sidebar does not affect main dashboard filter)
- Sidebar transaction list updates when a sidebar category is tapped
- Card-style modals with backdrop dismiss on desktop

### PWA (Progressive Web App)

- Installable on Android and iOS via browser "Add to Home Screen"
- Service worker with stale-while-revalidate caching strategy (`public/sw.js`)
- Web manifest: standalone display, dark theme, portrait orientation (`public/manifest.json`)
- Apple-specific meta tags for iOS home screen experience
- Correct viewport meta tag (`width=device-width, initial-scale=1, viewport-fit=cover`) injected at build time — ensures Samsung Galaxy and Android Chrome detect the correct device width from the first paint

---

## Database Schema

> Full reference: [`supabase/db/schema.md`](./supabase/db/schema.md)

### Tables

| Table | Purpose |
| --- | --- |
| `accounts` | Financial accounts (name, currency, icon, created_by, tag_ids) |
| `account_members` | User–account relationships for sharing (user_id, account_id, role) |
| `account_settings` | Per-account config (included_in_balance, carry_over_balance, initial_balance, initial_balance_date) |
| `account_invites` | Sharing tokens (token, name, invited_by, expires_at, used_at) |
| `categories` | Transaction categories (name, type, color, icon, tag_ids); user-owned, visible to connected users |
| `tags` | Tags scoped by account membership (name, color, icon) |
| `transactions` | Financial transactions (account_id, category_id, amount, note, type, date) |
| `transaction_tags` | Many-to-many join between transactions and tags |
| `user_preferences` | Per-user prefs (account_order, primary_account_id, excluded_account_ids) |
| `user_hidden_categories` | Per-user category hiding (user_id, category_id) |
| `user_profiles` | Public user discovery (display_name, email, avatar_url, avatar_source_url) for the friend system |
| `friends` | Directional friend relationships (user_id → friend_user_id, status: pending/accepted/rejected/blocked) |
| `contacts` | Named contacts for external pool participants (display_name, linked user optional) |
| `pools` | Shared expense pools (name, type: event/continuous, created_by, start_date, end_date, status) |
| `pool_members` | Unified pool membership: auth users and external participants (type: auth/external, user_id nullable, external_name nullable, contact_id nullable) |
| `pool_transactions` | Pool expenses (pool_id, paid_by → pool_members.id, amount, description, date) |
| `debts` | Settlement debts (from_user, to_user, amount, pool_id, status, from_confirmed, to_confirmed, participant name fields) |

### Key Design Decisions

- Categories are user-owned (`user_id` FK) and shared across all accounts — no per-account scoping
- Connected users (sharing at least one account) automatically see each other's categories via RLS
- Users can hide unwanted categories per-user without affecting others (`user_hidden_categories`)
- `pool_members` unifies auth users and external participants in a single table; `paid_by` on pool transactions references `pool_members.id`, enabling external payers
- Transfer categories are a global system record (`is_default = true`, `user_id = NULL`) shared by all users
- Category icons are stored as Lucide component names; `Icon.tsx` resolves them at render time
- Row Level Security (RLS) is enabled on all tables; users can only access their own data and shared accounts
- `account_members` SELECT policy is terminal (`user_id = auth.uid()` only); cross-table membership checks use SECURITY DEFINER RPCs to avoid infinite recursion
- Friends use directional rows with mutual acceptance; blocked users cannot see the relationship
- `pool_members.user_id` is nullable (external members have no user account); a CHECK constraint enforces that auth members have `user_id` and external members have `external_name`

### SECURITY DEFINER RPCs

| Function | Purpose |
| --- | --- |
| `is_account_member(acc_id)` | Returns true if `auth.uid()` is a member of the account |
| `share_account(p_account_id, p_user_id)` | Adds a user to an account as a member |
| `unshare_account(p_account_id, p_user_id)` | Removes a user from an account |
| `get_friend_account_memberships(p_friend_ids)` | Returns a map of which accounts each friend can access |
| `get_account_co_members(p_user_id)` | Returns all users who share at least one account with the caller |
| `get_pool_members(p_pool_id)` | Returns pool members with contact data joined |
| `add_pool_member(p_pool_id, p_user_id, p_display_name, p_contact_id)` | Adds a member to a pool (auth or external) |
| `remove_pool_member(p_member_id)` | Removes a pool member |
| `delete_own_account(p_account_id)` | Cascade-deletes an account the caller owns |

---

## Project Structure

```text
finduo/
  App.tsx                          Entry: SafeAreaProvider > AuthProvider > RootNavigator
  index.ts                         registerRootComponent(App)
  app.json                         Expo config (scheme, icons, web PWA settings)
  public/
    manifest.json                  PWA web manifest
    sw.js                          Service worker (stale-while-revalidate)
    icon.png                       PWA icon
  scripts/
    patch-web.js                   Post-build: inject PWA tags + viewport meta into dist/index.html
    import-monefy.js               CLI tool to import Monefy CSV exports
    create-env.js                  Environment file creation helper
  src/
    components/
      Icon.tsx                     Unified Lucide icon component (name -> component)
      AppHeader.tsx                Standalone header for non-dashboard screens (avatar, logo, spinner)
      dashboard/
        AccountModal.tsx           Create/edit account modal
        AccountPickerSheet.tsx     Full-screen account picker (mobile)
        CategoryModal.tsx          Create/edit category modal
        ChangelogModal.tsx         Changelog viewer (PATCHNOTES + README, scroll-to-top FAB)
        DatePickerModal.tsx        Custom calendar date picker
        EntryModal.tsx             Transaction entry modal (desktop card + mobile fullscreen)
        FriendsModal.tsx           Friends management (list, requests, add, account sharing)
        IconPickerSheet.tsx        Lucide icon grid picker (~1,900 icons, lazy-loaded)
        InvitationsModal.tsx       Token-based invite management
        QuickNavigation.tsx        Side-panel nav (accounts, categories, tags, FinOps, friends, settings)
        TagModal.tsx               Create/edit tag modal
        TransferModal.tsx          Cross-account transfer modal with exchange-rate support
        boxes/
          OverviewCard.tsx         Balance overview + interval picker + account overview grid
          SpendingChart.tsx        Category bar chart + desktop battery chart
          CategoriesRow.tsx        Category chips row (tap-to-add)
          TransactionSection.tsx   Transaction list with filter-aware header + invite card
        layout/
          DashboardLayout.tsx      Outermost frame: loading screen + assembles all sections
          DashboardHeader.tsx      Header: avatar, logo, view-mode toggle (desktop) / spinner reload (mobile)
          DashboardBody.tsx        Desktop wrapper + edge-swipe PanResponder + sidebar
          MainScrollView.tsx       Main ScrollView + warning banner + Box components
          DesktopSidebar.tsx       Sidebar (desktop): totals, accounts, spending, transactions
          ScrollTopFab.tsx         Scroll-to-top FAB (visible when scrollY > 320)
          BottomActions.tsx        Filter bar + income/transfer/expense bottom buttons
          ModalsRoot.tsx           Renders all modal/sheet components from context
          ContextBar.tsx           Animated section indicator bar (slides in from behind header)
      pool/
        AddMemberModal.tsx         Add member: friends tab or external tab (by name/contact)
        CreatePoolModal.tsx        Create pool modal (name + type selector)
        PoolActions.tsx            Add Expense + Add Member action buttons
        PoolHeader.tsx             Header: back, settle, close, delete, add buttons
        PoolListContent.tsx        Pool list with loading and empty states
        PoolMemberChips.tsx        Member chip row (purple for external participants)
        PoolSummaryCard.tsx        Total / members / per-person summary card
        SettlementModal.tsx        Compute → preview → commit settlement flow
        TransactionList.tsx        Read-only expense list with edit/delete (creator only)
        TransactionModal.tsx       Add/edit expense with full member payer selector
        poolStyles.ts              Shared StyleSheet for all pool components
      sections/
        PoolsSection.tsx           Embedded pool list + detail view (no navigation header)
        LendingSection.tsx         Embedded debt list with confirm and record actions
        SettlementsSection.tsx     Embedded debts + pools accordion view
        ContactsSection.tsx        Embedded contacts list (merged pool contacts + friends; edit/add)
    context/
      AuthContext.tsx              Auth state, Google OAuth (web + native), deep link handling
      DashboardContext.tsx         All dashboard state + actions (DashboardProvider + useDashboard())
    hooks/
      useDashboardData.ts          Core data loading + targeted state update setters
      useDebts.ts                  Debt management: computePoolSettlement, commitPoolSettlement, confirmDebt
      useFriends.ts                Friends system: requests, acceptance, blocking, profile upsert, account sharing
      usePool.ts                   Pool detail state: selectedPool, poolMembers, poolTotal, perPerson, handlers
      usePools.ts                  Pool CRUD: create, list, add/load members, close, delete
      usePoolTransactions.ts       Pool transaction CRUD: add, list, update, delete expenses
      useContacts.ts               Contact CRUD + findOrCreateContactForUser
    lib/
      devtools.ts                  uiPath, uiProps, logUI, logAPI, webAlert utilities
      supabase.ts                  Supabase client (PKCE, AsyncStorage on native)
      version.ts                   APP_VERSION constant, fetchLatestVersion(), isNewerVersion()
    utils/
      settlePool.ts                Pure settlement algorithm (greedy debtor-creditor matching)
    navigation/
      index.tsx                    Root navigator: Login vs Dashboard based on session
    screens/
      DashboardScreen.tsx          Composition shell: <DashboardProvider><DashboardLayout />
      DashboardScreen.styles.ts    Shared StyleSheet for dashboard components
      LendingScreen.tsx            Debts list: confirm, net balance, convert to transaction
      LoginScreen.tsx              Google sign-in UI
      PoolScreen.tsx               Orchestration shell: pool list + detail, owns modal state
      SettlementsScreen.tsx        Debts + Pools accordion view, compute/record settlements
    types/
      auth.ts                      AuthContextValue interface
      dashboard.ts                 App data types (AppAccount, AppCategory, AppTag, etc.)
      friends.ts                   Friend types (ResolvedFriend, ResolvedRequest, etc.)
      pools.ts                     Pool and debt types (Pool, PoolParticipant, PoolTransaction, AppDebt, PreTransaction, SettleResult)
  supabase/
    db/
      schema.md                    Human-readable schema reference (tables, columns, RLS)
    migrations/
      0000_baseline.sql            Full schema baseline (all tables, indexes, RLS, functions)
      20260401_unified_pool_participants.sql
      20260401c_clean_rls_baseline.sql
      20260401e_production_full_fix.sql
      20260402b_temp_categories_on_revoke.sql
      20260402c_global_transfer_categories.sql
      20260402d_cleanup_leftover_transfer_categories.sql
      20260402e_transfer_category_icon.sql
      20260402f_pools_insert_policy.sql
      20260402g_pools_granular_rls.sql
      20260402h_pool_members_nullable_user_id.sql
      archive/                     Superseded incremental migrations (history only)
```

---

## Getting Started

### 1. Clone and install

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase project URL and anon key (Supabase Dashboard → Settings → API).

### 3. Set up Google OAuth

1. Go to **Authentication → Providers → Google** in your Supabase Dashboard.
2. Enable the provider and add your OAuth credentials.
3. Add `finduo://` as an authorised redirect URL (for native).
4. Add your production web URL as a redirect URL (for web).

### 4. Apply the database schema

Run `supabase/migrations/0000_baseline.sql` in your Supabase SQL editor, or push via CLI:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Then apply incremental migrations in order:

1. `20260401_unified_pool_participants.sql`
2. `20260401c_clean_rls_baseline.sql`
3. `20260401e_production_full_fix.sql`
4. `20260402b_temp_categories_on_revoke.sql`
5. `20260402c_global_transfer_categories.sql`
6. `20260402d_cleanup_leftover_transfer_categories.sql`
7. `20260402e_transfer_category_icon.sql`
8. `20260402f_pools_insert_policy.sql`
9. `20260402g_pools_granular_rls.sql`
10. `20260402h_pool_members_nullable_user_id.sql`

### 5. Start development

```bash
npx expo start          # All platforms
npx expo start --web    # Web only
```

---

## Build and Deploy

### Web (PWA)

```bash
npm run build:web       # Exports to dist/ and patches with PWA tags + viewport meta
npm run serve:web       # Serve dist/ locally for testing
```

### Android (preview build)

```bash
eas build -p android --profile preview --non-interactive
```

### Import Monefy Data

```bash
node scripts/import-monefy.js --csv <path-to-export.csv> --user-id <supabase-user-id>
```

---

## Development

### Validate before committing

```bash
npx tsc --noEmit        # TypeScript check
git status --short      # Review changed files
```

### Bump the app version

Update `src/lib/version.ts` (`APP_VERSION`) and `package.json` (`version`) together when releasing.

### DevTools

Set `EXPO_PUBLIC_DEBUG_UI=true` in `.env` to render green dashed outlines on all instrumented UI elements (web only). All interactions emit `[UI]` prefixed messages; all Supabase calls emit `[API]` prefixed messages to the browser console.

---

## Roadmap

### Architecture

- [x] Context-based dashboard (`DashboardContext` / `DashboardProvider`)
- [x] TanStack Query cache layer with targeted invalidation
- [x] Full DevTools tracing across all screens and components
- [ ] Split `DashboardContext` into finer-grained hooks to reduce re-renders
- [ ] Dedicated screens for account management and category management
- [ ] Supabase Realtime subscriptions for live updates between shared users

### Features

- [x] Pool settlement calculations (compute → preview → commit)
- [x] Pool deletion and closure (creator-only)
- [x] Lending between friends with debt confirmation
- [x] Convert confirmed debts directly to Dashboard transactions
- [ ] Recurring transactions (subscriptions, salary, rent)
- [ ] Budget limits per category with alerts
- [ ] Line chart for balance trends over time
- [ ] Pie chart for spending breakdown
- [ ] Export data to CSV or PDF
- [ ] Multi-currency dashboard with base-currency conversion and live rates
- [ ] Push notifications for shared account activity
- [ ] Dark/light theme toggle
- [ ] Transaction search and advanced filtering
- [ ] Bulk transaction operations (multi-select, delete, re-categorise)
- [ ] Receipt photo attachment
- [ ] Account balance history and net worth tracking

### Technical

- [x] Targeted state updates for mutations (no full refetch after save/delete)
- [x] Android back button intercept (closes modals)
- [x] Cross-platform alert/confirm (`webAlert` on web, `Alert.alert` on native)
- [x] Hard reload with service worker unregistration and full cache clear
- [ ] Unit tests and integration tests
- [ ] Remove legacy `loadMaterialSymbols` files (dead code)
- [ ] Remove `material-icons` package (no longer used)
- [ ] Add proper error boundaries
- [ ] Offline support with sync queue
- [ ] CI/CD pipeline (lint, typecheck, test, build)
