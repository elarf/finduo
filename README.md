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
```

## Key files
| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Initialises the Supabase client with AsyncStorage-backed session persistence |
| `src/context/AuthContext.tsx` | Global auth state – session, user, `signInWithGoogle`, `signOut` |
| `src/navigation/index.tsx` | Root navigator – shows Login or Dashboard based on session |
| `src/screens/LoginScreen.tsx` | Unauthenticated landing page with Google sign-in button |
| `src/screens/DashboardScreen.tsx` | Post-login home screen (balance overview placeholder) |
