# Finduo

Financial tracking app for couples. Track income, expenses, and transfers across shared accounts with real-time sync, category-based spending insights, and cross-currency support.

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
- Custom calendar date picker for transaction date selection
- Transactions sorted by user-chosen date (database `created_at` is hidden)
- Recent amount suggestions based on history
- Infinite scroll with progressive loading (12 at a time)
- Amount text colored green (income) or red (expense)

### Transfers
- Dedicated transfer flow between accounts with currency conversion support
- Exchange rate or destination amount input for cross-currency transfers
- Transfer transactions use a "Transfer" category and are excluded from income/expense totals
- Transfers still affect net account balance
- Transfer transactions display with a `↔` indicator

### Categories
- Per-account categories with type (income/expense), color, and icon
- Income and Expense categories shown in separate dropdown sections in quick navigation
- Icon picker with 37 Lucide icons mapped from Material Symbol names
- Auto-suggest icon based on category name keywords
- Category-based spending chart (horizontal bar chart with tap-to-filter)
- Tap a category chip to quickly add a transaction pre-filled with that category

### Tags
- Per-account tags with optional color and icon
- Attach tags to transactions, categories, and accounts
- Inline tag creation in the transaction entry modal

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

### Pools & Shared Expenses
- Create event or continuous pools for shared expense tracking
- Add members to pools, track expenses, and settle balances
- Settlement algorithm minimizes number of transfers
- Event pools close after settlement; continuous pools remain active
- Pool settlements automatically generate debts in the lending system

### Lending System
- Person-to-person debt tracking independent of pools
- Create debts with amount, description, and optional due date
- Both parties must confirm debt before status becomes 'confirmed'
- Track debt status: pending → confirmed → paid
- Debts can be disputed or cancelled

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
- Full-screen slide-up transaction modal with reordered layout: date → amount → note → tags → numpad → category → save/cancel
- Income/expense toggle with colored active states (green/red)
- Persistent bottom bar with large Cancel and Save buttons
- Swipe-to-select category picker: press "Choose Category" and drag to a category without lifting finger (PanResponder-based)
- Category picker also works as a normal tappable grid
- Cannot save a transaction without choosing a category (enforced in UI)
- Scroll-to-top floating action button appears when scrolled past 320px
- Logo shown on loading screen

### Desktop UX
- Two-column layout at viewport width >= 1024px
- Framed mobile preview mode (430px max-width with borders)
- Card-style modals with backdrop dismiss
- Collapsible sections for spending chart and categories

### Quick Navigation Menu
- Account management with icons (large when not editing, hidden in edit mode)
- Income and Expense category sections with icons and colors
- Edit/delete buttons hidden behind edit mode toggle per section (accounts, categories, tags)
- Friends modal access
- Full app reload (web: page reload, native: dashboard reload)
- Invitations access
- Interval selection
- Sign out

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

## 🧠 Architecture Notes

- Pool and Lending systems are implemented as separate domains
- Pool handles shared expense tracking and settlement calculation
- Lending handles persistent debts between users
- Integration between the two is planned but not tightly coupled

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `accounts` | Financial accounts (name, currency, icon, created_by, tag_ids) |
| `account_members` | User-account relationships for sharing (user_id, account_id, role) |
| `account_settings` | Per-account config (included_in_balance, carry_over_balance, initial_balance, initial_balance_date) |
| `account_invites` | Sharing tokens (token, name, invited_by, expires_at, used_at) |
| `categories` | Transaction categories (name, type, color, icon, tag_ids); per-account or global |
| `tags` | Tags per account (name, color, icon) |
| `transactions` | Financial transactions (account_id, category_id, amount, note, type, date, tag_ids) |
| `transaction_tags` | Many-to-many join between transactions and tags |
| `user_preferences` | Per-user prefs (account_order, primary_account_id) |
| `user_profiles` | Public user discovery (display_name, email, avatar_url) for friend system |
| `friends` | Directional friend relationships (user_id → friend_user_id, status: pending/accepted/rejected/blocked) |
| `pools` | Shared expense pools (name, type: event/continuous, currency, status, created_by) |
| `pool_members` | Pool membership (pool_id, user_id, role: owner/member) |
| `pool_expenses` | Pool transactions (pool_id, paid_by, amount, description, split_among) |
| `pool_settlements` | Settlement snapshots (balances, transfers, expense_ids) |
| `pool_debts` | Pool-generated debts (settlement_id, from/to user, amount, status) |
| `debts` | Standalone lending system (from/to user, amount, description, status, confirmations) |

### Key Design Decisions
- Transfer categories are detected by `category.name === 'Transfer'` — created per-account if no global one exists
- Category icons are stored as Material Symbol names in the database; `Icon.tsx` maps them to Lucide components at render time
- Row Level Security (RLS) is enabled; users can only access their own data and shared accounts
- Friends use directional rows with mutual acceptance; blocked users cannot see the relationship
- Account sharing via friends creates `account_members` rows — same as invite tokens but non-expiring and revocable
- Pool settlements generate debts in both `pool_debts` (tied to settlement) and `debts` (standalone tracking)
- Pool expenses are stored separately from account transactions — pools don't affect account balances

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
        PoolListModal.tsx          Pool management UI (list, create, expenses, settlement)
        TagModal.tsx               Create/edit tag modal
        TransferModal.tsx          Cross-account transfer modal
    context/
      AuthContext.tsx               Auth state, Google OAuth (web + native), deep link handling
    hooks/
      useDashboardData.ts          Core data loading: accounts, categories, tags, transactions, settings
      useDebt.ts                   Standalone debt system: create, confirm, list debts
      useFriends.ts                Friends system: requests, acceptance, blocking, account sharing
      usePool.ts                   Pool management: create, expenses, settlements, pool-specific debts
    lib/
      supabase.ts                  Supabase client init (PKCE, AsyncStorage on native)
    navigation/
      index.tsx                    Root navigator: Login vs Dashboard based on session
    screens/
      DashboardScreen.tsx          Main screen: all CRUD, modals, charts, gestures
      DashboardScreen.styles.ts    Shared StyleSheet for dashboard components
      LoginScreen.tsx              Google sign-in UI
      PoolScreen.tsx               Pool management screen (standalone, not integrated with dashboard)
    types/
      auth.ts                      AuthContextValue interface
      dashboard.ts                 App data types, helpers (AppAccount, AppCategory, etc.)
      debt.ts                      Standalone debt types (Debt, ResolvedDebt, CreateDebtData)
      friends.ts                   Friend system types (ResolvedFriend, ResolvedRequest, etc.)
      pool.ts                      Pool types (Pool, PoolExpense, PoolSettlement, etc.)
    utils/
      settlement.ts                Pure settlement algorithm (minimize transfers)
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

### Technical
- [ ] Add unit tests and integration tests
- [ ] Remove legacy `loadMaterialSymbols` web/native files (dead code)
- [ ] Remove `material-icons` package from dependencies (no longer used)
- [ ] Add proper error boundaries
- [ ] Implement optimistic updates for better perceived performance
- [ ] Add offline support with sync queue
- [ ] Set up CI/CD pipeline (lint, typecheck, test, build)
- [ ] Add Supabase realtime subscriptions for live updates between shared users
- [ ] Consider migrating from PKCE browser redirect to popup-based OAuth for better mobile web UX
