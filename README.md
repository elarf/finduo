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

### Transactions
- Add income and expense transactions with amount, date, category, note, and tags
- Display-only amount field with custom numpad (avoids keyboard on mobile)
- Custom calendar date picker for transaction date selection
- Transactions sorted by user-chosen date (database `created_at` is hidden)
- Recent amount suggestions based on history
- Infinite scroll with progressive loading (12 at a time)

### Transfers
- Dedicated transfer flow between accounts with currency conversion support
- Exchange rate or destination amount input for cross-currency transfers
- Transfer transactions use a global "Transfer" category and are excluded from income/expense totals
- Transfers still affect net account balance
- Transfer transactions display with a `↔` indicator

### Categories
- Per-account categories with type (income/expense), color, and icon
- Icon picker with 37 Lucide icons mapped from Material Symbol names
- Auto-suggest icon based on category name keywords
- Category-based spending chart (horizontal bar chart with tap-to-filter)
- Tap a category chip to quickly add a transaction pre-filled with that category

### Tags
- Per-account tags with optional color
- Attach tags to transactions, categories, and accounts
- Inline tag creation in the transaction entry modal

### Sharing & Invitations
- Share accounts with other users via invite tokens
- Token-based invite system: generate a token, share it, recipient pastes to join
- Configurable expiration (default 7 days)
- Named invites for tracking who was invited
- Shared accounts appear alongside owned accounts

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

### Mobile UX
- Full-screen slide-up transaction modal on mobile
- Swipe-to-select category picker: press "Choose Category" and drag to a category without lifting finger (PanResponder-based)
- Category picker also works as a normal tappable grid
- Cannot save a transaction without choosing a category (enforced in UI)
- Scroll-to-top floating action button appears when scrolled past 320px

### Desktop UX
- Two-column layout at viewport width >= 1024px
- Framed mobile preview mode (430px max-width with borders)
- Card-style modals with backdrop dismiss
- Collapsible sections for spending chart and categories

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
| `accounts` | Financial accounts (name, currency, created_by, tag_ids) |
| `account_members` | User-account relationships for sharing (user_id, account_id, role) |
| `account_settings` | Per-account config (included_in_balance, carry_over_balance, initial_balance, initial_balance_date) |
| `account_invites` | Sharing tokens (token, name, invited_by, expires_at, used_at) |
| `categories` | Transaction categories (name, type, color, icon, tag_ids); `account_id=NULL` for global |
| `tags` | Tags per account (name, color) |
| `transactions` | Financial transactions (account_id, category_id, amount, note, type, date, tag_ids) |
| `transaction_tags` | Many-to-many join between transactions and tags |
| `user_preferences` | Per-user prefs (account_order, primary_account_id) |

### Key Design Decisions
- Transfer categories are global (`account_id = NULL`, `name = 'Transfer'`) with separate entries for type `income` and `expense`
- The app detects transfers by matching `category.name === 'Transfer'`
- Category icons are stored as Material Symbol names in the database; `Icon.tsx` maps them to Lucide components at render time
- Row Level Security (RLS) is enabled; users can only access their own data and shared accounts

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
    context/
      AuthContext.tsx               Auth state, Google OAuth (web + native), deep link handling
    lib/
      supabase.ts                  Supabase client init (PKCE, AsyncStorage on native)
      loadMaterialSymbols.ts       No-op on native
      loadMaterialSymbols.web.ts   Legacy web font loader (currently unused)
    navigation/
      index.tsx                    Root navigator: Login vs Dashboard based on session
    screens/
      LoginScreen.tsx              Google sign-in UI
      DashboardScreen.tsx          Main screen (~4600 lines): all CRUD, modals, charts, gestures
    types/
      auth.ts                      AuthContextValue interface
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
- [ ] Break `DashboardScreen.tsx` (~4600 lines) into smaller components/hooks
- [ ] Extract business logic into custom hooks (useTransactions, useAccounts, useCategories, etc.)
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
