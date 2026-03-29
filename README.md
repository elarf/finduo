# Finduo

Financial tracking app for couples. Track income, expenses, and transfers across shared accounts with real-time sync, category-based spending insights, and cross-currency support.

## Patch Notes

### v0.6 — UX polish, tag filtering, avatar reliability
**Entry modal**
- Desktop view now uses a centred 390 px card instead of the full viewport width
- Bottom bar is now context-aware: no category selected → "Choose Category" button; category selected → "Save to [icon] [name]"; category selected + back → "Reselect" clears the selection
- Tags section moved above the numpad and rendered as a wrap grid (two rows), sorted by usage frequency within the selected category
- Note field shows a live read-only preview of selected tags alongside the typed note, matching how the transaction will be displayed in the list
- Date field appends ", Today" when the selected date is the current day

**Date picker**
- Week now starts on Monday
- Saturday and Sunday are colored red in both the header row and day cells

**Tag filter**
- Tags in the Quick Navigation menu are now tappable: tap to filter all transactions globally; tap again to deactivate
- Active tag filter highlighted with the tag's own color and a small filter icon
- "global" label removed from tag rows

**Filter notification bar**
- A bar slides in above the bottom navigation whenever any filter is active (category, tag, or transfers-only)
- Shows a summary of active filters (e.g. "category + tag filter active")
- A "✕ Clear all" button on the right resets all filters at once

**Scroll-to-top FAB**
- Repositioned to `right: 100, bottom: 130` to avoid overlapping the bottom bar and keep small transaction amounts visible

**Avatar reliability**
- `AuthContext` now normalises the Google profile image from both `avatar_url` and `picture` metadata keys and exposes it as `avatarUrl`
- All avatar `<Image>` components have an `onError` handler that falls back to the user's initial; error state resets automatically on re-login
- `useFriends` profile upsert also checks the `picture` key so the `user_profiles` table stays in sync

**Android back button**
- Pressing back when no modal is open now shows an "Exit app?" confirmation dialog instead of silently doing nothing

## Tech Stack

- **Frontend:** React Native 0.83.2 + Expo SDK 55, TypeScript
- **Web:** react-native-web with PWA support (installable on Android/iOS)
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security)
- **Auth:** Google OAuth (PKCE flow)
- **Icons:** lucide-react-native (Material Symbol names mapped to Lucide components)

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
- Transfer transactions use a "Transfer" category and are excluded from income/expense totals
- Transfers still affect net account balance
- Transfer transactions display with a `↔` indicator

### Categories
- User-global categories shared across all accounts (not per-account)
- Categories are owned by users, not accounts — survive account deletion
- Connected users (sharing any account) see each other's categories automatically
- Per-user category hiding: hide categories you don't want without deleting them
- Categories have type (income/expense), color, and icon
- Friend's categories are read-only (view and use, but cannot edit or delete)
- Income and Expense categories shown in separate dropdown sections in quick navigation
- Icon picker with 37 Lucide icons mapped from Material Symbol names
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
- Pool creator can add members by user ID
- All members can add expenses; only the payer can delete their own
- Per-person split shown automatically (total / member count)
- Pool can be closed to prevent further transactions
- RLS ensures users can only see pools they are members of

### Settlements & Lending
- Unified Settlements screen accessible from Quick Navigation menu
- Three sections: Pools list, Active pool view, Debts
- Pool settlement calculates minimum debts using a greedy algorithm (equal split, minimize transfers)
- Debts require dual confirmation (from_user and to_user must each confirm independently)
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
- Lending link with pending debt badge (navigates to LendingScreen)
- Settlements link (navigates to unified Settlements screen)
- Pools link (navigates to PoolScreen)
- Friends modal access
- Invitations access
- Full app reload (web: page reload, native: dashboard reload)
- Interval selection
- Sign out
- Mobile: swipe from left edge to open
- Menu order: Lending, Settlements, Pools, Friends, Invitations, Reload app, Sign out

### Header
- Logo click refreshes dashboard data (profile button is not blocked)
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

### Tables

| Table | Purpose |
|-------|---------|
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
| `pool_members` | Pool membership join table (pool_id, user_id) |
| `pool_transactions` | Pool expenses (pool_id, paid_by, amount, description, date) |
| `debts` | Settlement debts (from_user, to_user, amount, pool_id, status, from_confirmed, to_confirmed) |

### Key Design Decisions
- Categories are user-owned (`user_id` FK) and shared across all accounts — no per-account scoping
- Connected users (sharing at least one account) automatically see each other's categories via RLS
- Users can hide unwanted categories per-user without affecting others (`user_hidden_categories` table)
- Transfer categories are detected by `category.name === 'Transfer'` — auto-created per-user when making the first transfer
- Category icons are stored as Material Symbol names in the database; `Icon.tsx` maps them to Lucide components at render time
- Row Level Security (RLS) is enabled; users can only access their own data and shared accounts
- Friends use directional rows with mutual acceptance; blocked users cannot see the relationship
- Account sharing via friends creates `account_members` rows — same as invite tokens but non-expiring and revocable

## Project Structure

```
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
        DatePickerModal.tsx        Custom calendar date picker
        EntryModal.tsx             Transaction entry modal (desktop card + mobile fullscreen)
        FriendsModal.tsx           Friends management (list, requests, add, account sharing)
        IconPickerSheet.tsx        Lucide icon grid picker
        InvitationsModal.tsx       Token-based invite management
        TagModal.tsx               Create/edit tag modal
        TransferModal.tsx          Cross-account transfer modal
    context/
      AuthContext.tsx               Auth state, Google OAuth (web + native), deep link handling
    hooks/
      useDashboardData.ts          Core data loading + targeted state update setters (accounts, categories, tags, transactions, settings)
      useFriends.ts                Friends system: requests, acceptance, blocking, account sharing
      usePools.ts                  Pool CRUD: create, list, add members, close
      usePoolTransactions.ts       Pool transaction CRUD: add, list, delete expenses
      useDebts.ts                  Debt management: settle pool, confirm, mark paid
    lib/
      supabase.ts                  Supabase client init (PKCE, AsyncStorage on native)
    utils/
      settlePool.ts                Pure settlement algorithm (greedy debtor-creditor matching)
    navigation/
      index.tsx                    Root navigator: Login vs Dashboard based on session
    screens/
      LoginScreen.tsx              Google sign-in UI
      DashboardScreen.tsx          Main screen: all CRUD, modals, charts, gestures
      DashboardScreen.styles.ts    Shared StyleSheet for dashboard components
      PoolScreen.tsx               Standalone pool screen: list, create, detail, transactions
      LendingScreen.tsx            Standalone lending screen: debts list, confirm, mark paid
      SettlementsScreen.tsx         Unified settlements: pools + debts in one screen
    types/
      auth.ts                      AuthContextValue interface
      dashboard.ts                 App data types, helpers (AppAccount, AppCategory, etc.)
      friends.ts                   Friend system types (ResolvedFriend, ResolvedRequest, etc.)
      pools.ts                     Pool and debt types (Pool, PoolMember, PoolTransaction, AppDebt)
  supabase/
    migrations/                    SQL migration files
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

### 4. Create the `user_preferences` table
Run this in your Supabase SQL editor:
```sql
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_order TEXT[] NOT NULL DEFAULT '{}',
  primary_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own preferences"
  ON public.user_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 5. Apply other migrations
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 6. Start development
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
- [ ] Extract more business logic into custom hooks (useTransactions, useAccounts, useCategories)
- [ ] Add a state management layer (Zustand, Jotai) to replace deeply nested useState
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
- [x] Lending between friends
- [ ] Friend-to-friend spending comparison (categories are shared, UI for comparison needed)

### Technical
- [ ] Add unit tests and integration tests
- [ ] Remove legacy `loadMaterialSymbols` web/native files (dead code)
- [ ] Remove `material-icons` package from dependencies (no longer used)
- [ ] Add proper error boundaries
- [x] Implement targeted state updates for mutations (no full refetch after save/delete)
- [x] Android back button intercept (closes modals; exit confirmation dialog on dashboard)
- [ ] Add offline support with sync queue
- [ ] Set up CI/CD pipeline (lint, typecheck, test, build)
- [ ] Add Supabase realtime subscriptions for live updates between shared users
- [ ] Consider migrating from PKCE browser redirect to popup-based OAuth for better mobile web UX
