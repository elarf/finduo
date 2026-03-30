# Finduo – Patch Notes

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
