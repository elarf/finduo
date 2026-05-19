# Finduo – Patch Notes

<!-- markdownlint-disable MD013 MD024 MD036 -->

---

## [1.3.0] — 2026-05-19

### Features

#### FinGo — Active Asset Designation

- Assets can be marked as **active** per type (bike, shoe, vehicle); only one active asset per type at a time
- Active badge shown on the asset header in the accordion
- **Set as active** toggle in the asset create/edit modal — activating an asset automatically deactivates all other assets of the same type for the user
- `setActiveAsset(assetId, assetType)` in `useAssets` deactivates same-type assets first, then activates the target

#### FinGo — Edit Usage Logs

- Tap any ride log row to open it in edit mode
- `UsageLogModal` gains full edit mode: fields pre-populated from the existing log (date, time, distance/steps, moving time, elevation, notes)
- Submit button label changes to **Update** in edit mode
- `updateLog(log, asset, entry)` in `useUsageLogs` patches the log record and adjusts asset totals with delta diffs

#### FinGo — Custom Timestamps on Usage Logs

- Date & time fields in `UsageLogModal` allow backdating and timestamp correction
- `recordedAt` ISO timestamp propagated through `UsageEntry` and stored in `recorded_at` on the usage log row
- HealthConnect entries now pass `startTime` as `recordedAt` so logs reflect the actual activity time

#### HealthConnect — Auto-Attach to Active Assets

- On each screen load, unlogged cycling exercise sessions automatically attach to the active bike asset
- Daily step records automatically aggregate per day and attach to the active shoe asset (one log per day, using `steps-<date>` synthetic external ID for deduplication)
- Dismissable green banner shows count of items auto-logged in the current session

#### FinGo — Service Interval Notifications (Native)

- New `src/lib/fingo/notifications.ts` module
- `setupFinGoChannels()` creates a `fingo_service_due` Android notification channel on startup
- `notifyDueIntervals()` fires local notifications for any component interval that is due or overdue after a usage log is added

### Improvements

#### FinGo — Back Button Image Refresh

- `DashboardHeader` back button now uses `back.png` instead of the arrow-left icon
- `ComponentDetailScreen` and `ServiceIntervalDetailScreen` back buttons replaced with `back.png` in a circular button container

#### FinGo — Android Back Handler in Detail Screens

- `ComponentDetailScreen` and `ServiceIntervalDetailScreen` now register Capacitor back button handlers
- Modal-priority chain: ComponentForm → Library → SwapModal → IntervalSheet → RecordSheet → ActionSheet

#### FinGo — Component Changes Refresh Assets

- `loadAssets()` called after all component mutations (install, uninstall, retire, replace, delete, interval create/delete, record service) so asset-level stats stay in sync

#### DateTimeFields — Time Picker Cleanup Fix

- Web time picker input element now removed from the DOM on cancel (via the `cancel` event) — previously it could linger when the user dismissed without selecting

### Technical

- `src/types/fingo.ts` — `is_active?: boolean | null` on `FinGoAsset`; `recordedAt?: string` on `UsageEntry`
- `src/hooks/useAssets.ts` — `setActiveAsset(assetId, assetType)` added and exported; `createAsset` now returns the created `FinGoAsset | null`; `is_active` added to `updateAsset` patch type
- `src/hooks/useUsageLogs.ts` — `updateLog(log, asset, entry)` added and exported; `notifyDueIntervals` called after `addUsageLog`; component `name` added to SELECT; `recorded_at` stored when `entry.recordedAt` is present
- `src/lib/fingo/notifications.ts` — new file; `setupFinGoChannels`, `notifyDueIntervals`
- `src/components/fingo/AssetAccordion.tsx` — active badge on asset header; ride log rows converted to `TouchableOpacity` with `onEditLog` prop and "tap to edit" hint; `onEditLog` prop added
- `src/components/fingo/UsageLogModal.tsx` — `editingLog` prop; `useEffect` initialises fields from log; `isoToDateStr`, `isoToTimeStr`, `buildIso` helpers; `DateTimeFields` added to modal
- `src/components/fingo/DateTimeFields.tsx` — `cancel` event listener added to clean up input on dismiss
- `src/screens/FinGoScreen.tsx` — `assetIsActive` state in asset modal; `setActiveAsset`/`updateLog` wired; `loadAssets()` chained after all component mutations; `setupFinGoChannels` on mount
- `src/screens/HealthConnectScreen.tsx` — auto-attach `useEffect` for active bike (cycling) and active shoe (daily steps); `autoAttachBanner`; `recordedAt` set in all `buildEntry` paths
- `src/screens/ComponentDetailScreen.tsx` — `registerBackHandler` for modal priority; `back.png` button with circular container style
- `src/screens/ServiceIntervalDetailScreen.tsx` — `registerBackHandler` for modal priority; `back.png` button with circular container style
- `assets/fingo/back.png` — new back button image asset

---

## [1.2.9] — 2026-05-13

### Improvements

#### HealthConnect — Workout Enhancements

- **Named exercise types** — workout cards now display human-readable activity names (Running, Cycling, HIIT, Yoga, etc.) resolved from Health Connect integer exercise type codes via a full `HC_EXERCISE_NAMES` lookup table; biking detection uses the integer codes directly
- **Data origin badges** — each workout card shows the source app name (Strava, Samsung Health, Google Fit, Garmin Connect, Polar Beat, Wahoo, Suunto) as a badge; unknown package IDs fall back to the last segment of the package name
- **Workout deduplication** — auto-detects duplicate sessions (same date, duration, and distance from different sources); duplicates are hidden by default; a **"N hidden"** pill appears in the filter bar and toggles visibility
- **Manual hide/unhide** — each workout card has a **Hide** / **Unhide** button; manually hidden workouts count toward the hidden total; auto-hidden duplicates can be individually restored
- **Average speed** — workouts display an avg km/h stat when distance and duration are both present
- **Sub-minute duration** — duration now shows seconds when under an hour (e.g. `45m 30s` instead of `45m`)
- **Start time** — each workout card shows the session start time below the date
- **Attach fix** — `addUsageLog` return value checked; session is only marked as logged on success; distance value now correctly passed to the usage log entry
- **Range change reset** — switching the time range now clears manual hide/unhide state

### Technical

- `src/lib/fingo/tracking/HealthConnectCapacitorBridge.ts` — `dataOrigin?: string` added to `RawRecord` type
- `src/lib/fingo/tracking/HealthConnectTrackingProvider.ts` — `dataOrigin?: string` added to `HCRecord`; passed through in `readHealthConnectData`
- `src/screens/HealthConnectScreen.tsx` — `HC_EXERCISE_NAMES` (60-entry lookup), `DATA_ORIGIN_NAMES` map, `getHCActivityName`, `isBikingHC`, `formatDataOrigin` helpers; `detectDuplicates` auto-hides same-date/duration/distance sessions; `manualHiddenIds` + `manualUnhiddenIds` state; `effectiveHiddenIds` derived from auto + manual sets; visibility toggle pill in filter bar; `workoutCardHidden` style (opacity 0.45); `paddingBottom` applied to all screen states; `movingTime` rounded in `buildEntry`
- `supabase/migrations/` — all incremental migration files consolidated into `0000_baseline.sql` and archived to `archive/`; `20260513c_grant_all_tables.sql` added

---

## [1.2.8] — 2026-05-13

### Features

#### HealthConnect — Aggregated View

- New **Aggregated / Raw** tab toggle on the HealthConnect screen
- **Aggregated tab** (default): workouts shown as cards with activity type, distance, and duration; biking sessions highlighted in green with an "eligible for part tracking" badge; daily steps merged into a single row per day with a "N records merged" hint when multiple records exist
- **Attach** button on each workout card opens the asset-attach sheet; persists attached state across remounts by fetching already-logged external IDs on screen mount

#### FinGo — `external_id` Deduplication for Usage Logs

- `usage_logs` table gains an `external_id` column for storing the originating source's record UUID (e.g. Health Connect session ID)
- `addUsageLog` accepts an optional `externalId` parameter and stores it alongside the log entry
- New `fetchLoggedExternalIds(source)` on `useUsageLogs` — queries all `external_id` values already recorded for a given source, enabling duplicate-import detection after screen remounts

### Technical

- `src/types/fingo.ts` — `external_id?: string | null` added to `UsageLog`
- `src/hooks/useUsageLogs.ts` — `fetchLoggedExternalIds(source)` added; `externalId` param added to `addUsageLog`; both exported from the hook
- `src/screens/HealthConnectScreen.tsx` — Aggregated/Raw tab bar; `AggregatedView` sub-component with `DaySteps` and `AggregatedWorkout` types; `aggregatedSteps` and `aggregatedWorkouts` memos; calls `fetchLoggedExternalIds('health_connect')` on mount; stores `attachRecord.id` as `externalId` when attaching; type-filter pill row shown on Raw tab only; raw record row refactored to icon-panel + body layout
- `supabase/migrations/20260513b_fingo_usage_log_external_id.sql` — `ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS external_id text`

---

## [1.2.7] — 2026-05-12

### Features

#### FinGo — Custom PNG Asset Icon System

- New `assets/fingo/` directory with 27 custom PNG icons covering UI actions (add, fix, gear, time, change, wipe, gps) and component types (chain, cassette, chainring, crank, derailleur, discpads, brake-rotor, tyre, tube, wheel, frame, fork, handlebar, saddle, cleatless, battery, charge)
- New `src/lib/fingo/fingoAssets.ts` — centralized `FINGO_ASSETS` registry typed as `Record<string, ImageSourcePropType>`
- `ComponentIcon` now resolves component names through `PNG_MAP` before falling back to bike SVG icons or Lucide icons; new `stretch` prop fills the parent height
- Component icon mappings refined: `discpads`, `tyre`, `tube`, `wheel`, `frame`, `chainring`, `cleatless`, `crank` all resolve to dedicated PNGs; brake pads and tyres now use correct per-type icons

#### FinGo — Service Interval Type

- New `service_type` field on `ComponentServiceInterval`: `general` (Fix), `replace` (Replace), `cleaning` (Clean), `charge` (Charge)
- `ServiceIntervalSheet` now shows a 4-option type picker (icon + label) when creating or editing an interval
- Service interval rows in `AssetAccordion` and `ServiceIntervalDetailScreen` show the type icon next to the interval name
- `useServiceIntervals` — `createInterval` accepts `serviceType` param; `updateInterval` patch type extended to include `service_type`

### UI Improvements

#### FinGo — Icon Refresh Throughout

- Asset stat chips (distance, time, rides, steps) use PNG icons instead of Unicode symbols (`↔`, `⏱`, `↺`, `👟`)
- Component cards in `AssetAccordion` show a large full-height PNG icon (was 16 px Lucide/SVG); meta counts display as icon+number chips
- GoButton: "GO" text label replaced with `gps.png` icon
- `ComponentLibrarySheet`: component icons enlarged to 40 px with dedicated `rowIconWrap` container
- `ComponentDetailScreen`: component icon enlarged from 36 px to 72 px; service type icon on identity header; `fix.png` on service record rows
- `ServiceIntervalDetailScreen`: service type icon on identity header; "Edit interval" action added to the actions modal (was "Set picture" placeholder); background `#060D18 → #000000`
- All `＋` text add-buttons throughout FinGo replaced with `add.png`
- HealthConnect: steps, distance, and exercise record icons now use `FINGO_ASSETS.step/route/ride` with emoji fallback for unsupported types
- Ride log rows in `AssetAccordion` now lead with `ride.png`

### Technical

- `assets/fingo/` — 27 PNG icons (add, battery, cassette, chain, chainring, change, charge, cleatless, crank, derailleur, discpads, fix, fork, frame, gear, gps, handlebar, pressure, ride, rotor, route, step, time, tube, tyre, wheel, wipe)
- `src/lib/fingo/fingoAssets.ts` — new file; exports `FINGO_ASSETS` typed registry
- `src/components/fingo/ComponentIcon.tsx` — `PNG_MAP` lookup before SVG/Lucide fallback; `stretch` prop added
- `src/lib/fingo/componentIcons.ts` — template key and keyword maps updated for new PNG icon names
- `src/types/fingo.ts` — `ServiceIntervalType` union type added; `service_type` field added to `ComponentServiceInterval`
- `src/hooks/useServiceIntervals.ts` — `serviceType` param in `createInterval`; `service_type` in `updateInterval` patch type
- `supabase/migrations/20260512_fingo_service_interval_type.sql` — adds `service_type` column (text, default `'general'`, check constraint for `general | replace | cleaning`)
- `supabase/migrations/20260513_fingo_service_interval_type_charge.sql` — extends check constraint to include `'charge'`

---

## [1.2.6] — 2026-05-11

### Bug Fixes

#### Google Profile Avatar Not Loading on APK — AppHeader

- `AppHeader` (used on non-dashboard screens) was reading `user?.user_metadata?.avatar_url` directly instead of using the normalized `avatarUrl` from `AuthContext`
- On Capacitor APK the Google OAuth payload may deliver the photo URL under `user_metadata.picture` or `identities[0].identity_data.*`; `AuthContext` already normalizes all variants but `AppHeader` bypassed that logic
- Fix: `AppHeader` now destructures `avatarUrl` from `useAuth()` so the same fallback chain used by `DashboardHeader` is applied everywhere

### Technical

- `src/components/AppHeader.tsx` — replaces manual `user?.user_metadata?.avatar_url` derivation with `avatarUrl` from `useAuth()`

---

## [1.2.5] — 2026-05-10

### Bug Fixes

#### Google Profile Avatar Not Loading on Android APK

- Google profile picture URLs (`lh3.googleusercontent.com`) fail to load in Capacitor's Android WebView; avatars were showing a letter-initial fallback on APK while working correctly on PWA
- Fix: `DashboardContext` now uploads the Google avatar to Supabase Storage on startup and uses the resulting permanent public URL for display — matching the upload logic already present in `useFriends.ts:ensureProfile`
- Fast path: if `user_profiles.avatar_source_url` already matches the current Google URL the stored Supabase URL is used immediately (one SELECT, no re-upload)
- Upload runs in the background with a cancellation guard — unmounting or user-switching exits the async flow cleanly
- `avatarImgError` reset effect extended to also clear when `storedAvatarUrl` first arrives, so the letter-initial fallback disappears as soon as the Supabase image is ready

### Technical

- `src/context/DashboardContext.tsx` — `storedAvatarUrl` state and async effect added; exposes `storedAvatarUrl ?? googleAvatarUrl` as `avatarUrl` to all consumers

---

## [1.2.4] — 2026-05-10

### Features

#### Capacitor Android APK Support

- Full Capacitor 7 integration: `@capacitor/core`, `@capacitor/app`, `@capacitor/browser`, `@capacitor/geolocation`, `@capacitor/status-bar`
- Google OAuth via Chrome Custom Tab with `com.finduo.fingo://auth/callback` deep-link redirect — the tab closes automatically when Android intercepts the callback
- Hardware back button handled via `initCapacitorBackButton()` — priority chain: registered component handlers (LIFO) → React Navigation stack → minimize app
- `registerBackHandler()` used in FinGoScreen, DashboardLayout, and AccountPickerSheet for internal modal/section dismissal
- `build:android` (`npm run build:web && npx cap sync android`) and `open:android` npm scripts for the Capacitor build workflow

#### Safe Area Insets — Full Native Support

- New `src/lib/safeArea.ts` utility: `topInset(base, nativeInset)` and `bottomInset(base, nativeInset)` — returns CSS `env(safe-area-inset-*)` on web, computed native value on APK
- Applied across all screens and modals: DashboardHeader, AppHeader, EntryModal, TransferModal, ModalShell, BottomActions, FinGoScreen, LoginScreen, QuickNavScreen
- Hardcoded Platform-conditional padding removed throughout `DashboardScreen.styles.ts`

#### Persistent Query Cache

- `QueryClientProvider` replaced with `PersistQueryClientProvider` from `@tanstack/react-query-persist-client`
- Cache serialized to AsyncStorage under key `FINDUO_QUERY_CACHE` with 1000 ms write throttle; `gcTime` bumped from 1h to 24h
- Dashboard data survives full app restarts — opens instantly from cache with no loading spinner
- Cache max age capped at 24h to prevent serving stale data across day boundaries

#### GPS Tracking Provider (FinGo)

- `GpsTrackingProvider` auto-selected on native Capacitor builds (uses `@capacitor/geolocation`)
- `ManualTrackingProvider` retained for web/PWA; provider is selected synchronously at module init via `Capacitor.isNativePlatform()`

### Improvements

#### Transaction Tags — Single-Query Fetch

- `useTransactionsQuery` now fetches tags in a single Supabase query using `.select('...,transaction_tags(tag_id)')` — eliminates the separate `transaction_tags` query and client-side join, halving DB round trips

#### "Tap to Load More" in Transaction Section

- "Scroll down to load more transactions" hint converted to a `TouchableOpacity` — tap loads 12 more entries on demand; works reliably on mobile and desktop without requiring scroll-to-bottom

### Bug Fixes

#### Hidden Categories — Cache Serialization

- `hiddenCategoryIds` changed from `Set<string>` to `string[]` in `CategoriesQueryData` so the value is JSON-serializable for AsyncStorage persistence
- `DashboardContext` now guards against deserialized non-Array values with `new Set(Array.isArray(...) ? ... : [])`

### Technical

- `capacitor.config.ts` — app ID `com.finduo.fingo`, `webDir: 'dist'`, `overlaysWebView: true` (Android 15 / targetSdkVersion=35 edge-to-edge), status bar `#53E3A6` with dark icons
- `src/lib/capacitorBack.ts` — singleton back button registry with LIFO handler priority and React Navigation fallback
- `src/lib/safeArea.ts` — `topInset` / `bottomInset` cross-platform helpers
- `src/lib/fingo/tracking/GpsTrackingProvider.ts` — Capacitor Geolocation-based tracking provider
- `src/navigation/navigationRef.ts` — React Navigation ref for imperative navigation outside the React tree
- `src/context/AuthContext.tsx` — `getLaunchUrl()` for Capacitor cold-start deep links; `appUrlOpen` listener closes Browser plugin and handles callback; `skipBrowserRedirect: true` for native OAuth
- `src/lib/fingo/tracking/TrackingService.ts` — `buildProvider()` selects GPS on native, manual on web

---

## [1.2.3] — 2026-05-08

### Improvements

#### FinGo — Asset Lifecycle Manager

**Asset Accordion — Header Redesign**

- Header background changed to black; asset type icon is full-height (max 80 px) and fully visible (no cropping)
- Asset type text label removed — the icon communicates the type
- All tracked stats shown in white with semantic icons: `↔` distance, `⏱` moving time, `▲` elevation, `↺` rides, `👟` steps; only non-zero values displayed

**Asset Accordion — Expand Behaviour**

- Tapping a header hides Upcoming Services, moves the selected asset to the top of the list, and scrolls there
- Opening a different accordion replaces the first position (only one open at a time)
- Closing reverts the list order and restores Upcoming Services

**Upcoming Services**

- Shows 3 items by default; "Show all (N)" / "Show less" toggle appears when more exist

**Component Service Intervals**

- All service intervals shown per component/sub-component (previously only the worst was shown)
- Each interval has its own progress bar rendered directly below it
- Intervals can be edited inline; each has its own delete button

**Component Tracking Fix**

- Fixed `track_elapsed_time` never updating on usage log — the field was missing from the pre-insert SELECT and the component UPDATE
- Removed a redundant `.eq('status', 'installed')` filter on the UPDATE that could silently skip components between read and write

**Component Forms**

- Asset name shown as a context tag when adding or editing a component
- In edit mode with multiple assets, a chip picker allows moving the component (and its full subtree) to a different asset

**Stats Tab**

- All linked transactions are now shown (previously capped at 10)

**Log Usage — Vehicles and Motorbikes**

- Toggle between "Distance travelled" and "Odometer reading" input modes
- Both fields stay in sync: entering one auto-calculates the other
- Odometer mode shows a warning if the entered reading is below the current total

### Technical

- `src/types/fingo.ts` — added `'motorbike'` to `AssetType`
- `src/hooks/useUsageLogs.ts` — `track_elapsed_time` added to component SELECT and UPDATE; redundant status filter removed
- `src/hooks/useComponents.ts` — `moveComponent` added: collects full subtree via client-side traversal, batch-updates `installed_on_asset_id`, clears `parent_component_id` on the root node
- `src/components/fingo/AssetAccordion.tsx` — header redesign; full-height asset type icon; white stats row with semantic icons; accordion scroll and list-reorder behaviour
- `src/components/fingo/ComponentRow.tsx` — all intervals listed with individual progress bars; `worstIntervalHealth` single bar removed
- `src/components/fingo/ComponentFormSheet.tsx` — asset context tag; asset chip picker in edit mode; `targetAssetId` parameter in `onSave`
- `src/components/fingo/ServiceDashboard.tsx` — show 3 / show all toggle
- `src/components/fingo/UsageLogModal.tsx` — odometer vs distance toggle for vehicles/motorbikes with cross-field sync
- `src/screens/FinGoScreen.tsx` — expanded asset floats to top of list via `displayedAssets` memo; `moveComponent` and interval editing wired
- `supabase/migrations/20260508_fingo_fix_component_tracking.sql` — fixes component tracking columns
- `supabase/migrations/20260508b_fingo_fix_component_trigger.sql` — fixes component tracking trigger

---

## [1.2.2] — 2026-05-07

### Features

#### FinGo — Asset Lifecycle Manager

- New **FinGo** screen: asset lifecycle tracking for vehicles, bikes, shoes, and other physical assets
- **Assets** — create and manage assets with type, icon, notes, and multi-metric usage tracking (distance, moving time, elevation, rides, steps)
- **Parts / components** — attach components to assets with service intervals, warn-at-percentage thresholds, and priority levels; components can be installed, stored, retired, or replaced
- **Usage logs** — log usage entries per asset from odometer, GPS, or Health Connect sources
- **Service records** — record service events per component with date and notes
- **Service dashboard** — at-a-glance overview of upcoming and overdue service deadlines across all assets
- **Component library** — reusable component templates that can be installed onto any asset
- **Category linking** — link Dashboard spending categories to an asset for financial summary within FinGo
- **Sort orders** — sort asset list by deadline, name, or priority
- **Access**: Quick Navigation menu (Wrench icon, amber color) and dedicated `FinGo` navigation route

### Technical

- `src/screens/FinGoScreen.tsx` — main FinGo screen with asset accordion, service dashboard, and all sheet modals
- `src/types/fingo.ts` — TypeScript definitions (FinGoAsset, AssetPart, Component, ComponentServiceInterval, UsageEntry, etc.)
- `src/hooks/useAssets.ts` — asset CRUD (create, update, delete, load)
- `src/hooks/useAssetParts.ts` — part CRUD and service tracking
- `src/hooks/useUsageLogs.ts` — usage log add and load
- `src/hooks/useAssetTransactions.ts` — category link and transaction stats
- `src/hooks/useComponents.ts` — component lifecycle (install, uninstall, retire, replace, storage)
- `src/hooks/useServiceIntervals.ts` — service interval CRUD
- `src/hooks/useServiceRecords.ts` — service record creation
- `src/components/fingo/` — ServiceDashboard, AssetAccordion, GoButton, ComponentLibrarySheet, ComponentFormSheet, ServiceIntervalSheet, ServiceRecordSheet, ComponentActionSheet
- `src/navigation/index.tsx` — `FinGo` added to RootStackParamList and navigator
- `src/components/dashboard/QuickNavigation.tsx` — FinGo menu item (Wrench icon, amber `#FBBF24`)
- `src/screens/QuickNavScreen.tsx` — FinGo menu item added
- `supabase/migrations/20260507_fingo_*.sql` — DB schema for assets, components, usage logs, service intervals, records, and RLS policies

---

## [1.2.1] — 2026-04-11

### UI Improvements

#### Quick Navigation — Add Button Asset

- Section header add buttons (Accounts, Income, Expense, Tags) now use the `new.png` custom asset instead of a text `＋` character
- Both the add and edit buttons are absolutely positioned side by side on the right of each section header — add button flush to the right edge, edit button with a 6px gap to its left
- Both buttons use identical sizing and full-height proportions (`width: 36, height: 100%`) for visual consistency

### Assets

- Added `new.png` — Custom add/create button asset for section headers in Quick Navigation

---

## [1.2.0] — 2026-04-10

### Architecture

#### Navigation Refactor — Modal Routes

- **Complete modal-to-route migration**: All modal-based screens converted to proper React Navigation routes
  - Removes 48 lines of modal state management from DashboardContext
  - Eliminates 35-line manual BackHandler with cascading if-checks
  - React Navigation now handles hardware/browser back buttons automatically
- **New route-based screens**:
  - `EntryScreen` — Income/expense entry form
  - `CategoryScreen` — Category create/edit
  - `TagScreen` — Tag create/edit
  - `AccountScreen` — Account create/edit
  - `TransferScreen` — Account transfers
  - `InvitationsScreen` — Account sharing invitations
  - `FriendsScreen` — Friends management
  - `QuickNavScreen` — Navigation menu
  - `PoolsScreen`, `LendingScreen`, `SettlementsScreen`, `ContactsScreen` — FinOps sections
- **Single DashboardProvider**: All authenticated screens share context instance for consistent state
- **Route params**: Editing IDs now passed via navigation params instead of context state
  - `navigation.navigate('Entry', { transactionId: '123' })`
  - Save functions accept editing IDs as parameters: `saveEntry(transactionId)`

### UI Improvements

#### Entry Modal

- **Transaction type gradients** on save button:
  - Income: Teal to blue (top-left to bottom-right)
  - Expense: Blue to orange (bottom-right to top-left)
- **Icon colors** updated to white for better contrast on gradients
- **Category picker** preserved as embedded fullscreen overlay (not a route)

#### Transfer Modal

- **Three-color gradient** on save button: Teal → Blue → Purple (bottom-left to top-right)

### Technical

- **Deleted**:
  - `ModalsRoot.tsx` (450 lines) — No longer needed
  - All modal visibility state flags (`showEntryModal`, `showCategoryModal`, etc.)
  - All editing ID state (`editingTransactionId`, `editingCategoryId`, etc.)
  - Manual BackHandler useEffect (35 lines)
- **Created**:
  - `ModalShell.tsx` — Reusable modal-style wrapper component
  - 13 new screen files in `src/screens/`
- **Updated**:
  - `src/navigation/index.tsx` — Wrapped all authenticated routes with single `DashboardProvider`
  - `DashboardContext.tsx` — Removed modal state, updated helpers to use navigation
  - `DashboardLayout.tsx` — Removed `<ModalsRoot />` component
  - `DashboardHeader.tsx` — Avatar tap navigates to `QuickNav` route
  - `CategoriesRow.tsx` — Long-press navigates to `Category` route
  - All modal screens now use `LinearGradient` from `expo-linear-gradient`

### Benefits

- ✅ Android hardware back button works correctly on all modals
- ✅ Browser back/forward navigation works correctly
- ✅ Deep linking ready (can navigate directly to modals via URLs)
- ✅ Cleaner architecture with navigation as single source of truth
- ✅ Better testability (test navigation state instead of boolean flags)

---

## [1.1.2] — 2026-04-10

### UI Improvements

#### Mobile Dashboard Enhancements

- **Bottom action buttons** now use custom PNG assets on mobile view
  - Income, Transfer, and Expense buttons display full-width image assets
  - Background changed to black for better visual integration
  - No gaps between buttons for seamless appearance
  - Desktop view retains original icon-based buttons
- **Search icon** in Recent Transactions header replaced with custom asset (50×50px)
  - Recent Transactions header background changed to black with rounded corners
- **Scroll to top button** now uses custom asset throughout the app
  - Applied to main dashboard scroll view
  - Applied to changelog modal
  - Asset replaces the previous green circular FAB

### Assets

- Added `addincome.png` — Custom income button asset
- Added `addexpensee.png` — Custom expense button asset
- Added `addtransfer.png` — Custom transfer button asset
- Added `searchicon.png` — Custom search icon asset
- Added `tothetop.png` — Custom scroll to top button asset

### Technical

- `src/components/dashboard/layout/BottomActions.tsx` — Conditional asset rendering for mobile vs desktop; transparent backgrounds on mobile
- `src/components/dashboard/layout/ScrollTopFab.tsx` — Replaced icon with image asset
- `src/components/dashboard/ChangelogModal.tsx` — Updated FAB to use image asset
- `src/components/dashboard/boxes/TransactionSection.tsx` — Search button now uses image asset
- `src/screens/DashboardScreen.styles.ts` — Updated bottomBar and sectionHeader backgrounds; added bottomBarMobile style

---

## [1.1.1] — 2026-04-08

### Improvements

#### FinBiome — 2D Mode Enhancements

- Implemented **2-state zoom system** for clearer navigation:
  - **FinBiome view** (default): Shows 3+ trees side-by-side with horizontal scrolling; tap trunk to zoom in
  - **FinTree view**: Zoomed detail view focusing on branches and leaves; free X+Y panning for exploration
- **MiniMap improvements**:
  - Now displays current account name instead of total account count
  - Fixed viewport indicator to show realistic proportions
  - Trees now expand across full minimap width
  - Zoom out button appears in FinTree mode to return to FinBiome view
  - Positioned at top-left (10px from canvas top)
- **Waterfall redesign**:
  - Completely static visual element at top-right corner (50px padding)
  - Two grey cliff blocks with cyan water flowing between them
  - Fixed to background layer — does not move when dragging trees or river
  - Tappable area isolated to waterfall region only
- **Tree structure corrections**:
  - Roots now properly grow from bottom of trunk (income categories)
  - Branches grow from top of trunk (expense categories)
  - Root width narrower than branch spread
- **Interaction improvements**:
  - Fixed horizontal drag in FinBiome view (was stuck)
  - Tree centering now properly snaps trunk to middle of viewport
  - Branch tap displays category name in minimap
  - Leaf tap displays transaction description in minimap
  - Prevented accidental FinFlow triggers when tapping tree elements
- **Rendering optimizations**:
  - Fixed extra tree appearing after last account
  - River layer hidden in FinTree mode (only branches/leaves visible)
  - Y-axis pan only available in FinTree mode

### Bug Fixes

#### Dashboard Header

- Fixed back button icon centering in circular avatar container

### Technical

- `src/context/FinBiomeContext.tsx` — Simplified to 2 view modes (biome/tree); added viewport-aware tree centering, minimap title state management
- `src/lib/finbiome/types2D.ts` — Updated ViewMode to 'biome' | 'tree'; added MiniMapTitle interface
- `src/components/finbiome/FinBiomeCanvas.tsx` — Fixed PanResponder to recreate on viewState change; added panY support; fixed totalWidth calculation
- `src/components/finbiome/ui/MiniMap.tsx` — Added centered tree name display; fixed viewport scaling
- `src/components/finbiome/layers/WaterfallLayer.tsx` — Simplified to static SVG with isolated tap area
- `src/components/finbiome/svg/WaterfallPath.tsx` — Redesigned as two cliffs with flowing water gradient
- `src/lib/finbiome/dataTransforms2D.ts` — Fixed root positioning to grow from trunk bottom; removed waterfall layout function
- `src/components/finbiome/layers/TreeLayer.tsx` — Added tap handlers for trunk/branch/leaf with viewMode-based behavior
- `src/screens/DashboardScreen.styles.ts` — Added alignItems/justifyContent to avatarBtn for proper icon centering

---

## [1.1.0] — 2026-04-07

### Features

#### FinBiome — 3D Financial Visualization

- New **FinBiome** screen: a 3D WebGL visualization system that transforms financial data into a living ecosystem
- **FinForest**: All account trees displayed side-by-side in 3D space
  - Account spheres at tree roots, category cubes as branches, transaction spheres as leaves
  - Auto-rotating orbital camera for ambient exploration
  - Organic forest layout with adequate spacing between account trees
- **Data transformation layer**: Converts accounts → categories → transactions into hierarchical 3D structures
- **Access methods**:
  - Mobile web: Swipe avatar rightward to spinner (~50% of screen width) as premium gesture
  - Desktop web: Tree icon button in header (replaces view toggle)
  - Quick Navigation menu: New FinBiome button above FinOps section
- **Platform support**: Web-only (mobile and desktop); native shows fallback message
- **Debug overlay**: Real-time display of data counts and scene parameters
- Built with **Three.js 0.140** using plain WebGL (no React wrappers for React 19 compatibility)

### Technical

- `src/screens/FinBiomeScreen.tsx` — Main 3D visualization screen with manual Three.js scene management
- `src/lib/finbiome/dataTransforms.ts` — Data transformation functions (buildForestLayout, buildTreeHierarchy, buildFlowData, buildRiverFlows)
- `src/lib/finbiome/types.ts` — TypeScript definitions for 3D data structures
- `src/components/dashboard/layout/DashboardHeader.tsx` — Avatar-to-spinner PanResponder gesture + desktop tree icon button
- `src/components/dashboard/QuickNavigation.tsx` — FinBiome menu item with tree icon
- `src/navigation/index.tsx` — FinBiome added to RootStackParamList as proper screen
- `metro.config.js` — ES module support (cjs, mjs extensions)
- `package.json` — three@0.140.0 added (pre-import.meta version for Metro compatibility)

---

## [1.0.9] — 2026-04-06

### Improvements

#### Numpad Button Feedback

- Refined numpad button press animation for better tactile feedback
- Color now appears **instantly** on press (no delay)
- Smooth **400ms fade-out** animation after release (previously instant disappearance)
- Each key animates independently with Animated.View for fluid transitions

### Technical

- `src/components/NumpadGrid.tsx` — refactored to individual `NumpadKey` components with `Animated.Value` per key; `onPressIn`/`onPressOut` handlers with 400ms fade timing

---

## [1.0.8] — 2026-04-06

### Features

#### Transaction Search

- New **Search** button in the Recent Transactions header (replaces the previous "+" quick-add button)
- Search across transaction notes, category names, tag names, and amounts
- Matching tags shown as colored chips above search results — tap a tag to autocomplete the search with that tag name
- Search activates inline with a text input replacing the section title
- Cancel button exits search mode and restores the normal view

#### Entry Modal — Tag Search and Layout

- Tags section redesigned to show exactly 2 rows: a fixed search box at the top + scrollable tag results below (max 66px height)
- Search input auto-sized to match placeholder text width ("search tags…")
- When no tags match the search, a green `+ Create "term"` chip appears — tap to create and toggle the tag
- Numpad position locked at bottom of modal; tag area scrolls internally without pushing other elements

### Bug Fixes

#### Transfer Modal — Account Picker Behind Modal

- AccountPickerSheet was rendered for `transfer-from` and `transfer-to` targets, appearing behind the TransferModal
- Fixed: AccountPickerSheet visibility now excludes transfer targets — TransferModal has its own inline account picker

#### Numpad Button Flash

- Pressable default opacity made the flash color appear dark and muted
- Fixed: added `opacity: 1` and `android_ripple` for vibrant, visible button feedback
- Flash colors updated to brighter Tailwind shades: red `#ef4444`, green `#22c55e`, purple `#a855f7`

### Technical

- `src/components/dashboard/boxes/TransactionSection.tsx` — search state, tag filtering, and inline search UI added
- `src/components/dashboard/EntryModal.tsx` — tag search, 2-row layout with fixed search box and scrollable results, create-from-search chip
- `src/components/dashboard/layout/ModalsRoot.tsx` — AccountPickerSheet visibility gated to exclude `transfer-from` and `transfer-to` targets
- `src/components/dashboard/TransferModal.tsx` — inline account picker replaces external sheet; flash colors brightened
- `src/components/NumpadGrid.tsx` — `opacity: 1` and `android_ripple` added for visible flash feedback

---

## [1.0.7] — 2026-04-03

### Bug Fixes

#### Header Spinner — PoolsSection and SettlementsSection Not Refreshing

- Tapping the dashboard header spinner called `reloadDashboard()`, which only invalidated TanStack Query caches; the embedded `PoolsSection` and `SettlementsSection` use independent hook instances and were never notified
- Fix: `DashboardContext` now exposes a `reloadKey` counter that increments on every `reloadDashboard()` call
- `PoolsSection` watches `reloadKey` and re-calls `getUserPools()` (and `getPoolTransactions()` if a pool is open) on change
- `SettlementsSection` watches `reloadKey` and re-calls `getUserPools()` + `getUserDebts()` on change

#### Pool Settlement — Members Could Initiate Settlement

- The **Settle** button in `PoolHeader` was not gated by `isCreator`, unlike the Close and Delete buttons
- Non-creator members who triggered settlement created broken debt rows (RLS rejects inserts where the settling user is not party to each debt pair) and the pool close step silently failed (creator-only RLS on `pools.update`)
- Fix: `onSettle` now requires `isActive && isCreator` in both `PoolsSection` and `PoolScreen`, matching the existing `onClose` and `onDelete` guard pattern

#### Pool Settlement — Pool Not Closed After Commit

- `commitPoolSettlement` called `supabase.from('pools').update(...)` without checking the returned error, so any failure (e.g. RLS rejection) was silently swallowed and the pool remained open
- Fix: error is now checked and thrown, surfacing the failure in the `SettlementModal` error display
- Fix: `end_date` is now also set on settlement close, matching the behavior of the explicit `closePool` call

#### Lending Badge — Broken and Confirmed Debts Inflating Count

- The pending debt badge in Quick Navigation counted all `status = 'pending'` debts, including broken debts (missing/unknown counterpart name) and debts the user already confirmed (which display in "Ready to record", not "Pending")
- Those entries are not actionable: broken debts only offer a delete button; confirmed ones are already handled
- Fix: `pendingDebtCount` in `DashboardContext` now matches the `DebtListSection` "Pending" filter — only counts debts that are `status = 'pending'`, not yet confirmed by the current user, and not broken

### Technical

- `src/context/DashboardContext.tsx` — `reloadKey: number` added to context type and value; incremented inside `reloadDashboard()` after query invalidation
- `src/components/sections/PoolsSection.tsx` — `reloadKey` consumed from `useDashboard()`; new effect reloads pool data on change
- `src/components/sections/SettlementsSection.tsx` — `reloadKey` consumed; new effect reloads pools and debts on change
- `src/components/sections/PoolsSection.tsx` + `src/screens/PoolScreen.tsx` — `onSettle` prop now conditional on `isCreator && isActive`
- `src/hooks/useDebts.ts` — `commitPoolSettlement` checks `closeError` and throws; sets `end_date` alongside `status: 'closed'`
- `src/context/DashboardContext.tsx` — `pendingDebtCount` filter tightened: excludes broken debts and debts already confirmed by the current user

---

## [1.0.6] — 2026-04-03

### Features

#### Contacts Section

- New **Contacts** item in the FinOps group of Quick Navigation; opens as an embedded section inside the Dashboard
- Merges contacts from pool participants and the friends list into a single unified list
- Avatar resolved from the linked friend's profile picture (if available), otherwise initials fallback with failed-image protection
- App user contacts show email as read-only (sourced from `auth.users`, not editable)
- Manual contacts can have display name, email, phone, and notes edited inline via a modal
- Add new contacts directly from the Contacts section

#### Lending Section Redesign

- **Pending** section now only shows debts the current user has not yet confirmed (previously mixed confirmed and unconfirmed)
- **Ready to record** — debts the user has self-confirmed (pending + my side confirmed) or both sides confirmed (`confirmed` status) are grouped here with a green **Record** button
- Tapping **Record** marks the debt as `recorded` in the DB, then navigates to the Dashboard with the entry modal pre-filled
- New **Recorded** section — debts that have been converted to a Dashboard transaction; shows an **Archive** button instead of Record
- New **Archived** section — collapsed by default; tap the header to expand; shows a **Record** button to re-record debts deleted by accident
- **Paid** section removed — status is visible on the debt row badge; a dedicated section added no value
- Broken debts (missing or "Unknown" counterpart name) shown in italic grey with a **broken** badge; a red trash button allows deletion — no record/archive actions offered for unresolvable entries

#### Avatar Persistence — Supabase Storage Snapshot

- `ensureProfile()` in `useFriends.ts` now downloads the OAuth avatar URL (Google, GitHub, etc.) and uploads a permanent copy to the `avatars` Supabase Storage bucket
- Uploaded once on first login, then only re-uploaded when the source URL changes (tracked via new `user_profiles.avatar_source_url` column)
- Permanent storage URL replaces the ephemeral OAuth CDN URL in `user_profiles.avatar_url` — avatars remain visible after OAuth tokens or CDN URLs expire
- Upload failure falls back gracefully to the raw OAuth URL so existing behaviour is never degraded

### Bug Fixes

#### Auth Loading Screen Background

- Loading screen shown while the session hydrates had a `#060A14` (dark navy) background instead of the intended pure black
- Fixed: background changed to `#000000`

### Technical

- `src/components/sections/ContactsSection.tsx` — new embedded contacts view (merged contacts + friends, avatar resolution, edit/add modal)
- `src/context/DashboardContext.tsx` — `activeSection` type extended to include `'contacts'`
- `src/components/dashboard/QuickNavigation.tsx` — Contacts button added to the FinOps sub-section
- `src/components/dashboard/layout/DashboardLayout.tsx` — routes to `<ContactsSection />` when `activeSection === 'contacts'`
- `src/hooks/useFriends.ts` — `ensureProfile` extended with Storage upload logic; reads `avatar_source_url` before uploading to detect changes
- `src/screens/LendingScreen.tsx` — sections restructured (Pending / Ready to record / Recorded / Archived); broken-debt detection and delete flow added
- `src/components/sections/LendingSection.tsx` — same section restructure and broken-debt handling as LendingScreen
- `src/hooks/useDebts.ts` — `markRecorded`, `archiveDebt`, `deleteDebt` added alongside existing `confirmDebt` and `markPaid`
- `src/navigation/index.tsx` — auth loading screen background changed from `#060A14` to `#000000`
- DB: `avatars` Supabase Storage bucket created (public, 2 MB limit, JPEG/PNG/WebP/GIF); `user_profiles.avatar_source_url TEXT` column added

---

## [1.0.5] — 2026-04-03

### Features

#### Dashboard Header — Spinner Reload Button

- Tapping the `spinner.gif` in the dashboard header (mobile right slot) now triggers a background data reload
- During reload the header swaps to `fdstar.gif`; the dashboard skeleton remains fully visible — no full-screen loading state
- Double-tap prevention: button is disabled while a reload is already in progress
- Uses the existing `reloading` flag from `DashboardContext` — TanStack Query invalidates all five query keys in parallel; `animateIn` count-up animation fires on completion

#### Embedded FinOps Sections — Pools, Lending, Settlements

- Pools, Lending, and Settlements are no longer separate navigation stack screens; they open as embedded sub-views inside the Dashboard
- Tapping a FinOps item in Quick Navigation sets `activeSection` in `DashboardContext` without any `navigation.navigate` call
- `DashboardLayout` routes to `<PoolsSection />`, `<LendingSection />`, or `<SettlementsSection />` when `activeSection` is set; the header and bottom bar stay in place
- `convertToTransaction` in `LendingSection` and `SettlementsSection` calls `setActiveSection(null)` then navigates to Dashboard with `prefillEntry` params — entry modal pre-fills as before

#### ContextBar — Animated Section Indicator

- New `ContextBar` component renders below the header when a FinOps section is active
- Slides in from behind the header (`translateY: -48 → 0`, spring animation); header has `zIndex: 10`, bar has `zIndex: 1`
- Label (section name) is tappable to dismiss the section; a `↓` hint guides the gesture
- Pools list view shows a `+` button in the right slot to open the create-pool modal
- All elements instrumented with `uiProps`/`uiPath` for testID tracing

#### Spinner Animations

- Auth loading screen (`RootNavigator`): `ActivityIndicator` replaced with `spinnerSMALL.gif` (80×80)
- Dashboard loading screen (`DashboardLayout`): logo + `ActivityIndicator` + text replaced with `fdstar.gif` (120×120, centered)
- Dashboard header right slot on mobile: always shows `spinner.gif` (36×36); `fdstar.gif` while reloading

#### Universal AppHeader

- `src/components/AppHeader.tsx` — standalone header component with no `DashboardContext` dependency
- Same visual as `DashboardHeader`: avatar left (acts as back button), logo centred, spinner.gif right on mobile
- Props: `onBack?: () => void`, `rightElement?: React.ReactNode`
- Used in `LendingScreen`, `SettlementsScreen`, `PoolScreen` (list view), and `ChangelogModal`

### Bug Fixes

#### PWA Android Home Screen Icon

- Android PWA was showing a white background on the home screen icon and black/masked corners on launch
- Root cause: a single `icon.png` served for both `"any"` and `"maskable"` purposes; `"maskable"` applies an inset safe-zone mask that cuts off the logo
- Fix: separate `icon-maskable.png` (512×512, solid `#060A14` background, logo contained within inner 80% safe zone) for the `"maskable"` purpose entry in `manifest.json`

#### PWA Android Stale Cached Icon

- Android PWA continued showing the old icon after assets were updated and pushed
- Fix: `CACHE_NAME` bumped to `'finduo-v2'` in `public/sw.js` (forces old service worker to evict and re-cache all assets); `?v=2` query param added to manifest icon URLs (forces browser to re-download the icon file)

### Technical

- `public/sw.js` — `CACHE_NAME` bumped from `finduo-v1` to `finduo-v2`
- `public/manifest.json` — icon entries split by purpose; maskable entry points to `icon-maskable.png?v=1`
- `src/context/DashboardContext.tsx` — `activeSection` / `setActiveSection` added to provider value
- `src/navigation/index.tsx` — `PoolScreen`, `LendingScreen`, `SettlementsScreen` removed from the navigator stack; `RootStackParamList` now contains only `Login` and `Dashboard`
- `src/components/dashboard/layout/ContextBar.tsx` — new component
- `src/components/AppHeader.tsx` — new component
- `src/components/sections/PoolsSection.tsx` — pool UI extracted from `PoolScreen.tsx` for embedded use
- `src/components/sections/LendingSection.tsx` — lending UI extracted from `LendingScreen.tsx` for embedded use
- `src/components/sections/SettlementsSection.tsx` — settlements UI extracted from `SettlementsScreen.tsx` for embedded use
- `DashboardScreen.styles.ts` — `headerRow` gains `zIndex: 10` so header paints over the sliding ContextBar
- All `uiPath` calls in `ContextBar` and `AppHeader` corrected from 2-arg to 3-arg format; `uiProps` spread added to every meaningful element

---

## [1.0.4] — 2026-04-02

### Bug Fixes

#### Avatar Overwritten with Null on Login

- `ensureProfile()` in `useFriends.ts` always included `avatar_url` in the upsert payload even when the metadata field was absent, overwriting stored avatars with `null` on every sign-in or token refresh
- Fix: `avatar_url` is only appended to the upsert payload when a non-null value is found in `user_metadata.avatar_url` or `user_metadata.picture`

#### Oversized Pool Member Chips

- Chips lacked an explicit `height`, causing them to inflate on web
- Replaced `paddingVertical: 3` with `height: 26` in `PoolMemberChips.tsx`

#### Pool INSERT Policy Missing

- No `pools` INSERT policy existed; authenticated users could not create new pools
- Added `pools_insert` policy: `WITH CHECK (created_by = auth.uid())`

#### Pool RLS — Silent Failures for SELECT / UPDATE / DELETE

- `pools_all` permissive policy caused silent failures: non-creator members could not see a newly created pool (member row did not yet exist at SELECT time); UPDATE/DELETE silently returned 0 rows with no error
- Replaced with three granular policies: `pools_select` (`created_by = auth.uid() OR is_pool_member(id)`), `pools_update` and `pools_delete` (creator-only USING + WITH CHECK)

#### External Pool Members — NOT NULL Violation (23502)

- `pool_members.user_id` carried a NOT NULL constraint in production, blocking insertion of external (contact-only) participants
- Migration: dropped NOT NULL from `pool_members.user_id`; added semantic CHECK (`auth` type requires `user_id`, `external` type requires `external_name`)

#### Pool Close Button — Wrong Visibility and Missing end_date

- Close button rendered for non-creators (RLS silently blocked the UPDATE); no `type === 'event'` guard; `end_date` not set on close
- Button now shown only when `isActive && isCreator && pool.type === 'event'`; `closePool` sets `end_date` alongside `status: 'closed'`

#### Settlement Plan Shows "Unknown" for Creator

- Creator was added via `add_pool_member` RPC with `p_display_name: null`; all name fields returned null, showing "Unknown" in the settlement preview
- Name resolution in `SettlementModal` now uses the enriched `members` state with metadata fallback

#### Multi-Settlement Not Prevented

- Non-creator members could call `commitPoolSettlement`, inserting duplicate debt rows (member policy allows INSERT) while the pool close step silently failed due to creator-only RLS
- Commit button gated on `pool.created_by === user.id`

#### LendingScreen — Truncated UUIDs and No Convert-to-Transaction

- Debt counterpart names fell back to truncated UUIDs; confirmed debts showed "Mark Paid" instead of "Record"
- Applied the same `convertToTransaction` / `prefillEntry` pattern as SettlementsScreen; name resolution now uses `to_participant_name` / `from_participant_name`

### Features

#### Settlement Screen Redesign

- Two-section accordion layout: **Debts** (starts collapsed) → **Pools** (starts expanded)
- Debt sub-sections: Pending, Ready to record (confirmed), Paid
- Pool rows expand inline with auto-calculated settlement plan on expand
- Confirmed debts and settled pool transfers show a green **Record** button

#### Convert Debt / Settlement to Transaction

- Tapping **Record** on any confirmed debt or settled pool transfer navigates to the Dashboard with the entry modal pre-filled (type, amount, descriptive note)
- Uses a `_key` dependency (debt ID) in the Dashboard `useEffect` so re-navigating to an already-mounted Dashboard always re-triggers the pre-fill

#### Quick Navigation — FinOps Section

- Pools, Lending, and Settlements grouped into a new collapsible **FinOps** section in Quick Navigation
- FinOps toggle shows the pending debt count badge when the section is collapsed
- "Experimental" renamed to **Settings**; Visible Intervals, Reload app, and Sign out moved inside

#### Quick Navigation — Version Indicator

- App version badge displayed in the title bar of the Quick Navigation panel (top-right)
- On open, fetches `package.json` from the GitHub main branch to detect the latest release
- Badge turns green and shows `vX.Y.Z → vA.B.C` when a newer version is available; tapping opens the ChangelogModal

#### Quick Navigation — Visual Alignment

- All nav buttons and section headers now use a consistent three-slot layout: dropdown indicator on the left, label centered, badge or action buttons on the right
- Section headers (Accounts, Income, Expense, Tags, Transfers) converted to `menuItem` style — same background, padding, border-radius as nav buttons

#### Interval Visibility Persisted to localStorage

- Selected visible intervals are stored in `localStorage` under the key `finduo_interval_visibility`
- Persists through app reload and hard refresh; new interval keys added in future versions default to visible on first load

#### Hard Reload — Fetch Latest Assets

- "Reload app" on web now unregisters the service worker, clears all cache storage, then navigates to the clean base URL
- Guarantees the browser fetches the latest deployed assets from the server instead of serving stale cached files

#### Mobile Viewport — Immediate Device Detection

- Added `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` to `patch-web.js`
- Fixes Samsung Galaxy (S22/S25 Ultra) and Android Chrome rendering with a 980 px desktop viewport on initial load; correct device width is now known from the very first paint

### Technical

- `supabase/migrations/20260402f_pools_insert_policy.sql` — adds `pools` INSERT policy
- `supabase/migrations/20260402g_pools_granular_rls.sql` — replaces `pools_all` with `pools_select`, `pools_update`, `pools_delete`
- `supabase/migrations/20260402h_pool_members_nullable_user_id.sql` — drops NOT NULL on `pool_members.user_id`, adds semantic CHECK constraint
- `src/lib/version.ts` — `APP_VERSION` constant, `fetchLatestVersion()` (GitHub main branch with cache-buster), `isNewerVersion()`
- `DashboardContext.tsx` — `intervalVisibility` lazy-initialised from `localStorage`, persisted via `useEffect`
- `patch-web.js` — viewport meta tag injected into `dist/index.html` at build time

---

## [1.0.3] — 2026-04-02

### Bug Fixes

#### Revoke Account Share — No Effect on Web

- `Alert.alert` button callbacks are silently discarded on React Native Web — the confirm dialog appeared but tapping Revoke never called `removeFriendFromAccount`, so nothing happened and no network request was made
- `FriendsModal.handleToggleAccount` now uses `window.confirm` on web and `Alert.alert` on native, matching the cross-platform pattern already used in `CategoryModal`

#### Duplicate Transfer Categories

- Creating a transfer used `findOrCreateCat` per user — multiple users each created their own "Transfer" expense and income categories, leading to duplicates across shared accounts
- Transfer is now a global system category: two stable rows (`is_default = true`, `user_id = NULL`) with fixed UUIDs shared by all users
- Existing per-user Transfer rows re-pointed to global IDs and deleted via migration
- Previously applied leftover per-user Transfer rows cleaned up via additional migration

### Features

#### All Lucide Icons in the Icon Picker

- Icon picker expanded from a curated static list of ~280 icons to the full `lucide-react-native` library (~1,900 icons)
- Icon list is derived dynamically from package exports — no static list to maintain; updates automatically with library upgrades
- Lazy loading: first 60 icons shown on open (~2 screen heights); scrolling appends 60 more per page
- Searching always shows all matching results instantly, bypassing pagination
- Web uses `ScrollView` with `onScroll` near-bottom detection; native uses `FlatList` with `onEndReached`

#### Transfer Category Icon

- Global Transfer categories now use the `Replace` Lucide icon instead of the `↔` text character

### Technical

- `supabase/migrations/20260402b_temp_categories_on_revoke.sql` — adds `temp_for` JSONB column to categories for future revoked-share handling
- `supabase/migrations/20260402c_global_transfer_categories.sql` — global Transfer category migration (`user_id = NULL`, `is_default = true`, stable UUIDs, RLS updated)
- `supabase/migrations/20260402d_cleanup_leftover_transfer_categories.sql` — cleanup of orphaned per-user Transfer rows
- `supabase/migrations/20260402e_transfer_category_icon.sql` — updates global Transfer icon to `Replace`

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
