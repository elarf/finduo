# finduo
Financial app for couples.

## Tech stack
- [Expo](https://expo.dev) (React Native, TypeScript)
- [Supabase](https://supabase.com) (auth, database, realtime)

## Getting started

### 1. Clone & install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
```
Edit `.env` and fill in your Supabase project URL and anon key (found in your Supabase Dashboard → Settings → API).

### 3. Set up Google OAuth in Supabase
1. Go to **Authentication → Providers → Google** in your Supabase Dashboard.
2. Enable the Google provider and add your OAuth credentials.
3. Add `finduo://` as an authorised redirect URL.

### 4. Start the development server
```bash
npx expo start
```

## Database migrations (Supabase)

This project uses SQL migrations in [supabase/migrations](supabase/migrations).

### Apply migrations to your Supabase project
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### Latest required migration
- [supabase/migrations/20260326_add_carry_over_and_invite_name.sql](supabase/migrations/20260326_add_carry_over_and_invite_name.sql)
  - Adds `account_settings.carry_over_balance` (boolean, default `true`)
  - Adds `account_invites.name` (text)

If these columns are missing, the dashboard now shows an in-app warning banner and alert.

## Build Android APK (preview)

```bash
eas build -p android --profile preview --non-interactive
```

Install from the Expo build page URL shown in terminal output.

## Validate before commit

```bash
npx tsc --noEmit
git status --short
```

## Commit and push checklist

1. Confirm migrations are applied (`npx supabase db push`).
2. Confirm type checks pass (`npx tsc --noEmit`).
3. Review staged files (`git diff --staged`).
4. Commit:

```bash
git commit -m "Add schema migration, dashboard schema checks, and build updates"
```

5. Push:

```bash
git push
```

## Project structure
```
/src
  /components   – Reusable UI components
  /context      – React contexts (AuthContext)
  /hooks        – Custom hooks
  /lib          – Third-party client setup (supabase.ts)
  /navigation   – React Navigation stack
  /screens      – Full-page screen components
  /services     – API / data-fetching helpers
  /types        – TypeScript type definitions
/supabase
  /migrations   – SQL database migrations
/scripts
  import-monefy.js – CLI import helper for Monefy CSV
```

## Key files
| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Initialises the Supabase client with AsyncStorage-backed session persistence |
| `src/context/AuthContext.tsx` | Global auth state – session, user, `signInWithGoogle`, `signOut` |
| `src/navigation/index.tsx` | Root navigator – shows Login or Dashboard based on session |
| `src/screens/LoginScreen.tsx` | Unauthenticated landing page with Google sign-in button |
| `src/screens/DashboardScreen.tsx` | Post-login dashboard (accounts, invites, transactions, schema warning checks) |
| `supabase/migrations/20260326_add_carry_over_and_invite_name.sql` | Adds required DB columns for carry-over and invite naming |
