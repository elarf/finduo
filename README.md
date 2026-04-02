# Finduo

<!-- markdownlint-disable MD013 MD024 -->

Financial tracking app for couples. Track income, expenses, and transfers across shared accounts with real-time sync, category-based spending insights, and cross-currency support.

## Patch Notes

### v1.0.3 — Account share revoke fix, all Lucide icons, global Transfer category

#### Bug Fixes

- **Revoke account access:** `Alert.alert` callbacks are silently discarded on web — confirm dialog appeared but never triggered the revoke; now uses `window.confirm` on web
- **Duplicate Transfer categories:** each user was creating their own "Transfer" categories; now a single global system category shared by all users (`is_default = true`, `user_id = NULL`)

#### Features

- **Icon picker:** expanded from ~280 curated icons to all Lucide icons (~1,900); lazy-loaded 60 per page, search returns all matches instantly
- **Transfer icon:** global Transfer category now uses the `Replace` Lucide icon
- Full list: [PATCHNOTES.md](./PATCHNOTES.md)

---

### v1.0.1 — ChangelogModal sanitization, migration cleanup

#### Bug Fixes

- **ChangelogModal:** `sanitizeContent` strips HTML comments and blank `---` separators before parsing fetched markdown, preventing rendering noise
- Full list: [PATCHNOTES.md](./PATCHNOTES.md)

#### Technical

- **Migration cleanup:** 9 outdated RLS migrations archived; new `20260401c_clean_rls_baseline.sql` is the authoritative RLS source
- Pool domain corrected to full-trust model: any member can UPDATE/DELETE pool transactions
- Stale SECURITY DEFINER functions removed; all policies use flat `EXISTS` subqueries

---

### v1.0.0 — DevTools tracing, pool deletion, numpad enhancements, changelog modal

#### Architecture

- Full DevTools tracing: every UI element has a stable `testID`/`data-ui` attribute; `logUI`/`logAPI` emit scoped console messages; `EXPO_PUBLIC_DEBUG_UI=true` highlights instrumented elements on web
- `src/lib/devtools.ts` — `uiPath`, `uiProps`, `logUI`, `logAPI`, `webAlert` utilities

#### Features

- Pool deletion: creator-only, behind edit toggle in pool header, confirmed by dialog
- Pool settle works with 1-member pools and auth + external member combinations; net amount shown as a banner with "Add as transaction" button
- Numpad: decimal dot, `00`, and `000` keys added; new bottom rows: `. 0 00` / `C 000 ←`
- Pools promoted to main Quick Navigation (above Friends); no longer in Experimental
- Changelogs modal (Experimental): shows PATCHNOTES.md with toggle to README; scroll-to-top FAB

#### Bug Fixes

- `Alert.alert` is a no-op on react-native-web — replaced with `webAlert` / `window.confirm` throughout
- Pool transaction FK violation (code 23503) when external member is payer — fixed in app and DB
- `closePool` returns `Promise<boolean>`; navigation only triggers on confirmed success
- Full list: [PATCHNOTES.md](./PATCHNOTES.md)

---

### v0.9.1 — Fixed shared account access

#### Bug Fixes

- **Shared account access:** Fixed critical issue where account creators couldn't access their own transactions/data after creation. Root cause: missing `account_members` rows for creators under current RLS architecture.
  - Client fixes: `saveAccount` auto-inserts creator membership, `joinByToken`/`addFriendToAccount` use upsert (prevents 409 conflicts)
  - Database fixes: Backfilled missing creator memberships, added auto-member trigger, cleaned RLS policies
- Full list: [PATCHNOTES.md](./PATCHNOTES.md)

---

### v0.9.0 — Cache-first data loading, pull-to-refresh (TanStack Query)

#### Architecture

- Cache-first data loading with `@tanstack/react-query` v5; five query hooks (`useAccountsQuery`, `useTransactionsQuery`, etc.) with stable keys and targeted invalidation
- App reopen behavior: renders instantly from cache if data < 5 min old; silent background refetch
- `DashboardContext` now proxies mutations to `queryClient.setQueryData`; all existing callbacks unchanged
- Pull-to-refresh added to main dashboard scroll view with haptic feedback

---

### v0.8.0 — Pool architecture, external members, settlement preview

#### Architecture

- `PoolScreen.tsx` refactored from 1024 lines to a ~120-line orchestration shell; all pool UI split into `src/components/pool/` components and a dedicated `usePool.ts` hook
- `SettlementsScreen` is now a pure read-only derivation view — settlement uses a **compute → preview → commit** flow; nothing writes to DB until the user explicitly confirms
- New `PreTransaction` type: settlement results are held in memory and previewed before being committed as debt records

#### Features

- External pool members: add participants who are not app users (by name); they can be selected as payer on expenses
- Unified `pool_participants` table replaces `pool_members`; `pool_transactions.paid_by` now references participant UUIDs (supports external payers)

#### Bug Fixes

- Payer selector now renders with any number of members (previously required 2+)
- Full list: [PATCHNOTES.md](./PATCHNOTES.md)

---

## Tech Stack

- **Frontend:** React Native 0.83.2 + Expo SDK 55, TypeScript
- **Web:** react-native-web with PWA support (installable on Android/iOS)
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security)
- **Auth:** Google OAuth (PKCE flow)
- **Icons:** lucide-react-native (Material Symbol names mapped to Lucide components)
- **DevTools:** `src/lib/devtools.ts` — stable `testID`/`data-ui` attributes, console tracing, debug overlay

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
- Numpad layout: `7 8 9` / `4 5 6` / `1 2 3` / `. 0 00` / `C 000 ←` — supports fast large-number and precise decimal entry
- Currency symbol shown inline with the amount (e.g. $123, €123, 123 Ft); no separate currency row
- Custom calendar date picker for transaction date selection
- Transactions sorted by user-chosen date (database `created_at` is hidden)
- Recent amount suggestions based on history
- Infinite scroll with progressive loading (12 at a time)
- Amount text colored green (income) or red (expense)
- Transaction list shows tags with color and icon inline, followed by note text
- If no note is provided, tag names are shown as the title; if neither, shows fallback text

### Transfers

- Dedicated transfer flow between accounts with currency conversion support
- Exchange rate or destination amount input for cross-currency transfers
- Transfer transactions use a global system "Transfer" category (`is_default`, shared by all users, not editable or deletable) and are excluded from income/expense totals
- Transfers still affect net account balance
- Transfer transactions display with a `↔` indicator and `Replace` icon

### Categories

- User-global categories shared across all accounts (not per-account)
- Categories are owned by users, not accounts — survive account deletion
- Connected users (sharing any account) see each other's categories automatically
- Per-user category hiding: hide categories you don't want without deleting them
- Categories have type (income/expense), color, and icon
- Friend's categories are read-only (view and use, but cannot edit or delete)
- Income and Expense categories shown in separate dropdown sections in quick navigation
- Icon picker with all ~1,900 Lucide icons; lazy-loaded 60 at a time, search returns all matches instantly
- Auto-suggest icon based on category name keywords
- Category-based spending chart (horizontal bar chart with tap-to-filter)
- Tap a category chip to quickly add a transaction pre-filled with that category
- Enables cross-user spending comparison within the same category

### Tags

- Global tags with optional color and icon
- Tag chips in transaction entry modal show each tag's icon and color; selected state uses background contrast
- Attach tags to transactions, categories, and accounts
- Inline tag creation in the transaction entry modal
- Tag delete from Quick Navigation menu keeps menu open (no disruptive close)

### Friends System

- Add other users as friends by email
- Mutual friend requests (send, accept, reject)
- Block users to prevent future requests
- Share accounts with friends directly — no token needed, no expiration
- Revoke friend access to accounts at any time
- Friend list shows profile pictures and shared account count
- Expand a friend to manage which accounts they have access to

### Sharing & Invitations

- Share accounts with other users via invite tokens
- Token-based invite system: generate a token, share it, recipient pastes to join
- Configurable expiration (default 7 days)
- Named invites for tracking who was invited
- Shared accounts appear alongside owned accounts

### Pools

- Shared expense pools for splitting costs with friends
- Two pool types: Event (one-time trip, dinner) or Continuous (roommates, recurring)
- Pool creator can add registered app users (friends) or external participants by display name
- External members shown with purple chip styling; can be selected as payer on any expense
- All members can add and edit expenses; payer selector shows every participant (auth + external)
- Per-person split shown automatically (total / member count)
- Pool creator can delete the pool (confirmation required); accessible via edit toggle in pool header
- Pool can be settled or closed; settle works with 1-member pools and auth + external combinations
- Settlement excludes external participants from the debt graph (their payments still count toward the total)
- Unified `pool_participants` table — `pool_transactions.paid_by` references participant UUIDs, not user UUIDs directly
- RLS ensures users can only see pools they are members of; member list exposed via SECURITY DEFINER RPC to bypass terminal SELECT policy

### Settlements & Lending

- Unified Settlements screen accessible from Quick Navigation menu (Experimental section)
- Two sections: read-only pool browser, Debts list
- Settlement uses a **compute → preview → commit** flow: tap Calculate Settlement, review each transfer (debtor → creditor, amount) as a `PreTransaction`, then Commit (persists debts + closes pool) or Discard (no DB write)
- `SettlementsScreen` is read-only — pool management (create, add expense, add member, close, delete) is done exclusively in PoolScreen
- Settlement algorithm: greedy debtor-creditor matching (equal split, minimum transfers)
- External pool members are excluded from the debt graph (debts are between auth users only)
- Debts require dual confirmation (from_user and to_user each confirm independently)
- Status flow: pending → confirmed (both sides confirmed) → paid
- Net balance card shows overall debt position
- Confirm and Mark Paid buttons contextually shown per debt

### Overview Mode

- Tap the balance card header to toggle between single-account and included-accounts overview
- Overview mode shows combined balance across all included accounts
- Categories section and bottom action buttons are hidden in overview mode
- Transaction list switches to show all included-account transactions with account badges
- Spending chart aggregates across all included accounts

### Date Filtering

- Interval options: Day, Week, Month, Year, All, Custom
- Custom range with start/end date inputs
- Balance carry-over respects interval boundaries
- Opening balance computed from pre-interval transactions when carry-over is enabled

### Balance Card

- Income colored green, expenses colored red
- Opening balance and total included balance colored by sign (green if positive, red if negative)
- Net balance with negative indicator

### Mobile UX

- Full-screen slide-up transaction modal layout: date → amount (with inline currency symbol) → note → tags → numpad → category → save/cancel
- Income/Expense type toggle moved into the modal header — tap the button to switch type; color updates live (green/red)
- No redundant close button — Cancel in the bottom bar is the only way to dismiss
- Tag chips in entry modal show the tag's icon and color; selected tags highlighted with background contrast
- Account icon displayed in modal header alongside account name
- Persistent bottom bar with large Cancel and Save buttons
- Swipe-to-select category picker: press "Choose Category" and drag to a category without lifting finger (PanResponder-based)
- Category picker and account picker transitions are instant (no slide animation delay)
- Category picker also works as a normal tappable grid
- Cannot save a transaction without choosing a category (enforced in UI)
- Scroll-to-top floating action button appears when scrolled past 320px
- Swipe from left edge to open Quick Navigation menu (PanResponder-based, 20px edge zone)
- Android hardware back button closes the topmost open modal/sheet; never exits the app or pops navigation
- Logo shown on full-width loading screen

### Desktop UX

- Two-column layout at viewport width >= 1024px
- Framed mobile preview mode (430px max-width with borders)
- Card-style modals with backdrop dismiss
- Collapsible sections for spending chart and categories
- Right sidebar: fixed "All Accounts" summary card at top, scrollable content below
- Sidebar spending chart with independent tap-to-filter (does not affect main dashboard filter)
- Sidebar filter updates transaction list title and filters transactions by selected category

### Quick Navigation Menu

- Account management with icons (large when not editing, hidden in edit mode)
- Income and Expense category sections with icons and colors
- Edit/delete buttons hidden behind edit mode toggle per section (accounts, categories, tags)
- **Pools** link (top-level, navigates to PoolScreen)
- **Friends** modal access
- **Experimental** section (collapsed by default, toggled by tapping): Lending, Settlements, Invitations, Changelogs
  - Lending link with pending debt badge (navigates to LendingScreen)
  - Settlements link (navigates to unified Settlements screen)
  - Invitations access
  - Changelogs modal — PATCHNOTES.md and README.md viewer with scroll-to-top FAB
- Full app reload (web: page reload, native: dashboard reload)
- Interval selection
- Sign out
- Mobile: swipe from left edge to open
- Menu order: Pools, Friends, Experimental (collapsed), Reload app, Sign out

### Header

- Logo is a static image (tap-to-refresh was replaced by pull-to-refresh)
- Profile/avatar button opens quick navigation sidebar
- Avatar shows Google profile picture or email initial fallback
- View mode toggle button (desktop/mobile)

### PWA (Progressive Web App)

- Installable on Android and iOS via browser "Add to Home Screen"
- Service worker with stale-while-revalidate caching strategy
- Web manifest with standalone display mode, dark theme, portrait orientation
- Apple-specific meta tags for iOS home screen experience
- Post-build script injects all PWA tags into the Expo web export

## Database Schema

> Full schema reference: [`supabase/db/schema.md`](./supabase/db/schema.md)

### Tables

| Table | Purpose |
| ------- | ------- |
| `accounts` | Financial accounts (name, currency, icon, created_by, tag_ids) |
| `account_members` | User-account relationships for sharing (user_id, account_id, role) |
| `account_settings` | Per-account config (included_in_balance, carry_over_balance, initial_balance, initial_balance_date) |
| `account_invites` | Sharing tokens (token, name, invited_by, expires_at, used_at) |
| `categories` | Transaction categories (name, type, color, icon, tag_ids); user-owned, shared via connected users |
| `tags` | Tags per account (name, color, icon) |
| `transactions` | Financial transactions (account_id, category_id, amount, note, type, date, tag_ids) |
| `transaction_tags` | Many-to-many join between transactions and tags |
| `user_preferences` | Per-user prefs (account_order, primary_account_id, excluded_account_ids) |
| `user_hidden_categories` | Per-user category hiding (user_id, category_id) |
| `user_profiles` | Public user discovery (display_name, email, avatar_url) for friend system |
| `friends` | Directional friend relationships (user_id → friend_user_id, status: pending/accepted/rejected/blocked) |
| `pools` | Shared expense pools (name, type: event/continuous, created_by, start_date, end_date, status) |
| `pool_participants` | Unified pool membership: auth users and external participants (type: auth/external, user_id nullable, external_name nullable) |
| `pool_transactions` | Pool expenses (pool_id, paid_by → pool_participants.id, amount, description, date) |
| `debts` | Settlement debts (from_user, to_user, amount, pool_id, status, from_confirmed, to_confirmed) |

### Key Design Decisions

- Categories are user-owned (`user_id` FK) and shared across all accounts — no per-account scoping
- Connected users (sharing at least one account) automatically see each other's categories via RLS
- Users can hide unwanted categories per-user without affecting others (`user_hidden_categories` table)
- Pool participants unified in `pool_participants` (replaces `pool_members`); `paid_by` on transactions references participant UUIDs, enabling external (non-user) payers; FK to `auth.users` is RESTRICT-only (not CASCADE) to prevent silent data loss
- Transfer categories are detected by `category.name === 'Transfer'` — auto-created per-user when making the first transfer
- Category icons are stored as Material Symbol names in the database; `Icon.tsx` maps them to Lucide components at render time
- Row Level Security (RLS) is enabled; users can only access their own data and shared accounts
- Friends use directional rows with mutual acceptance; blocked users cannot see the relationship
- Account sharing via friends creates `account_members` rows — same as invite tokens but non-expiring and revocable

## Project Structure

```text
finduo/
  App.tsx                          Entry point: SafeAreaProvider > AuthProvider > RootNavigator
  index.ts                         registerRootComponent(App)
  app.json                         Expo config (scheme, icons, web PWA settings)
  public/
    manifest.json                  PWA web manifest
    sw.js                          Service worker (stale-while-revalidate)
    icon.png                       PWA icon
  scripts/
    patch-web.js                   Post-build: inject PWA tags into dist/index.html
    import-monefy.js               CLI tool to import Monefy CSV exports
    create-env.js                  Environment file creation helper
  src/
    components/
      Icon.tsx                     Unified Lucide icon component (Material Symbol name -> Lucide)
      dashboard/
        AccountModal.tsx           Create/edit account modal
        AccountPickerSheet.tsx     Full-screen account picker (mobile)
        CategoryModal.tsx          Create/edit category modal
        ChangelogModal.tsx         Changelog viewer modal (PATCHNOTES + README, scroll-to-top FAB)
        DatePickerModal.tsx        Custom calendar date picker
        EntryModal.tsx             Transaction entry modal (desktop card + mobile fullscreen)
        FriendsModal.tsx           Friends management (list, requests, add, account sharing)
        IconPickerSheet.tsx        Lucide icon grid picker
        InvitationsModal.tsx       Token-based invite management
        QuickNavigation.tsx        Side-panel nav menu (accounts, categories, tags, pools, friends, experimental)
        TagModal.tsx               Create/edit tag modal
        TransferModal.tsx          Cross-account transfer modal
        boxes/
          OverviewCard.tsx         Balance overview + interval picker + account overview grid
          SpendingChart.tsx        Spending by category bars + desktop battery chart
          CategoriesRow.tsx        Category chips row (tap-to-add, long-press-to-edit)
          TransactionSection.tsx   Transaction list with filter-aware header + invite card
        layout/
          DashboardLayout.tsx      Outermost frame: loading screen + assembles all sections
          DashboardHeader.tsx      Header: avatar button, centered logo, view-toggle
          DashboardBody.tsx        desktopBodyWrapper + edge swipe PanResponder + sidebar
          MainScrollView.tsx       Main ScrollView + warning banner + Box components
          DesktopSidebar.tsx       Sidebar (desktop only): totals, accounts, spending, transactions
          ScrollTopFab.tsx         Scroll-to-top FAB (visible when scrollY > 320)
          BottomActions.tsx        Filter bar + income/transfer/expense bottom buttons
          ModalsRoot.tsx           Renders all modal/sheet components from context
      pool/
        PoolHeader.tsx             Header with back/settle/close/delete/add action buttons
        PoolSummaryCard.tsx        Total / members / per-person summary card
        PoolMemberChips.tsx        Horizontal member chip row (purple for external)
        PoolActions.tsx            Add Expense + Add Member action buttons
        TransactionList.tsx        Read-only transaction list with edit/delete (owner only)
        TransactionModal.tsx       Add/edit expense modal with full member payer selector
        AddMemberModal.tsx         Add member: friends tab (invite accepted users) or external tab (by name)
        CreatePoolModal.tsx        Create pool modal (name + type selector)
        PoolListContent.tsx        Pool list with loading and empty states
        poolStyles.ts              Shared StyleSheet for all pool components
    context/
      AuthContext.tsx              Auth state, Google OAuth (web + native), deep link handling
      DashboardContext.tsx         All dashboard state + actions (DashboardProvider + useDashboard())
    hooks/
      useDashboardData.ts          Core data loading + targeted state update setters
      useFriends.ts                Friends system: requests, acceptance, blocking, account sharing
      usePools.ts                  Pool CRUD: create, list, add participants (auth+external), close, delete
      usePool.ts                   Pool detail state: selectedPool, poolMembers, poolTotal, perPerson, settle/close/delete handlers
      usePoolTransactions.ts       Pool transaction CRUD: add, list, update, delete expenses
      useDebts.ts                  Debt management: computePoolSettlement, commitPoolSettlement, settlePoolDebts, confirm, mark paid
    lib/
      devtools.ts                  DevTools utilities: uiPath, uiProps, logUI, logAPI, webAlert
      supabase.ts                  Supabase client init (PKCE, AsyncStorage on native)
    utils/
      settlePool.ts                Pure settlement algorithm (greedy debtor-creditor matching)
    navigation/
      index.tsx                    Root navigator: Login vs Dashboard based on session
    screens/
      LoginScreen.tsx              Google sign-in UI
      DashboardScreen.tsx          Composition shell: <DashboardProvider><DashboardLayout />
      DashboardScreen.styles.ts    Shared StyleSheet for dashboard components
      PoolScreen.tsx               Orchestration shell: mounts pool components, owns modal state
      LendingScreen.tsx            Standalone lending screen: debts list, confirm, mark paid
      SettlementsScreen.tsx        Derivation-only settlements: read-only pool browser + compute→preview→commit + debts
    types/
      auth.ts                      AuthContextValue interface
      dashboard.ts                 App data types, helpers (AppAccount, AppCategory, etc.)
      friends.ts                   Friend system types (ResolvedFriend, ResolvedRequest, etc.)
      pools.ts                     Pool and debt types (Pool, PoolParticipant, PoolTransaction, AppDebt, PreTransaction, SettleResult)
  supabase/
    db/
      schema.md                    Human-readable schema reference (all tables, columns, RLS)
    migrations/
      0000_baseline.sql            Complete schema baseline (recreates all 16 tables from scratch)
      archive/                     Superseded incremental migrations (kept for history)
```

## Getting Started

### 1. Clone & install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase project URL and anon key (Supabase Dashboard > Settings > API).

### 3. Set up Google OAuth in Supabase

1. Go to **Authentication > Providers > Google** in your Supabase Dashboard.
2. Enable the Google provider and add your OAuth credentials.
3. Add `finduo://` as an authorised redirect URL (for native).
4. Add your production web URL as a redirect URL (for web).

### 4. Apply the database schema

Run `supabase/migrations/0000_baseline.sql` in your Supabase SQL editor, or push via CLI:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This single file creates all tables, indexes, RLS policies, and functions. See `supabase/db/schema.md` for the full schema reference.

For incremental updates, apply the following in order after the baseline:

1. `20260401_unified_pool_participants.sql` — replaces `pool_members` with `pool_participants`; remaps `pool_transactions.paid_by` to participant UUIDs
2. `20260401c_clean_rls_baseline.sql` — authoritative RLS rebuild: drops all prior policies, recreates full policy set with flat EXISTS pattern, creator membership backfill + trigger, debts participant columns

### 5. Start development

```bash
npx expo start          # All platforms
npx expo start --web    # Web only
```

## Build & Deploy

### Web (PWA)

```bash
npm run build:web       # Exports to dist/ and patches with PWA tags
npm run serve:web       # Serve locally for testing
```

### Android APK (preview)

```bash
eas build -p android --profile preview --non-interactive
```

### Import Monefy Data

```bash
node scripts/import-monefy.js --csv <path-to-export.csv> --user-id <supabase-user-id>
```

## Validate Before Commit

```bash
npx tsc --noEmit
git status --short
```

## Areas for Improvement

### Architecture

- [x] Extract dashboard logic into context (`DashboardContext`/`DashboardProvider`) and UI into Box/layout components
- [x] Full DevTools tracing across all screens and components (`src/lib/devtools.ts`)
- [ ] Split `DashboardContext` into finer-grained hooks (useTransactions, useAccounts, useCategories) to reduce re-renders
- [ ] Create dedicated screens for account management, category management, settings

### Features

- [ ] Recurring transactions (subscriptions, salary, etc.)
- [ ] Budget limits per category with alerts
- [ ] Charts: pie chart for spending breakdown, line chart for trends over time
- [ ] Export data to CSV/PDF
- [ ] Multi-currency dashboard with base-currency conversion
- [ ] Push notifications for shared account activity
- [ ] Dark/light theme toggle
- [ ] Transaction search and advanced filtering
- [ ] Bulk transaction operations (multi-select, delete, re-categorize)
- [ ] Receipt photo attachment on transactions
- [ ] Account balance history / net worth tracking over time
- [x] Pool settlement calculations (who owes whom)
- [x] Pool deletion (creator-only, confirmation required)
- [x] Lending between friends
- [ ] Friend-to-friend spending comparison (categories are shared, UI for comparison needed)

### Technical

- [ ] Add unit tests and integration tests
- [ ] Remove legacy `loadMaterialSymbols` web/native files (dead code)
- [ ] Remove `material-icons` package from dependencies (no longer used)
- [ ] Add proper error boundaries
- [x] Implement targeted state updates for mutations (no full refetch after save/delete)
- [x] Android back button intercept (closes modals; exit confirmation dialog on dashboard)
- [x] Cross-platform alert/confirm (`webAlert`, `window.confirm` on web; `Alert.alert` on native)
- [ ] Add offline support with sync queue
- [ ] Set up CI/CD pipeline (lint, typecheck, test, build)
- [ ] Add Supabase realtime subscriptions for live updates between shared users
- [ ] Consider migrating from PKCE browser redirect to popup-based OAuth for better mobile web UX
