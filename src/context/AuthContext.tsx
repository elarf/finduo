/**
 * AuthContext / AuthProvider.
 *
 * Wraps the app and exposes:
 *  - session / user  : current Supabase auth state
 *  - loading         : true while the initial session is being resolved
 *  - signInWithGoogle: starts the OAuth flow via expo-auth-session
 *  - signOut         : terminates the Supabase session
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthContextValue } from '../types/auth';

// Required so the browser tab can redirect back to the app on iOS / Android.
WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Normalise the Google avatar — OAuth may populate either avatar_url or picture.
  const avatarUrl: string | null =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    null;

  const handleDeepLink = useCallback(async (url: string) => {
    const { params, errorCode } = QueryParams.getQueryParams(url);

    if (errorCode) {
      console.error('OAuth callback error:', errorCode);
      return;
    }

    const code = typeof params.code === 'string' ? params.code : null;

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('Failed to exchange OAuth code:', error.message);
      }
      return;
    }

    const accessToken = typeof params.access_token === 'string'
      ? params.access_token
      : null;
    const refreshToken = typeof params.refresh_token === 'string'
      ? params.refresh_token
      : null;

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('Failed to restore OAuth session from callback:', error.message);
      }
    }
  }, []);

  // Listen for Supabase auth state changes and persist them.
  useEffect(() => {
    let mounted = true;

    // Restore persisted session and process an initial OAuth callback URL.
    (async () => {
      const [{ data }, initialUrl] = await Promise.all([
        supabase.auth.getSession(),
        Linking.getInitialURL(),
      ]);

      if (!mounted) return;

      setSession(data.session);
      setUser(data.session?.user ?? null);

      if (initialUrl) {
        await handleDeepLink(initialUrl);
      }

      if (mounted) {
        setLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Keep the public user_profiles row in sync whenever a session is
        // established (login) or the access token silently refreshes. This
        // ensures display_name and avatar_url are always current so other
        // users (pool members, friends) see up-to-date info without having
        // to trigger the friends flow first.
        if ((_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED' || _event === 'INITIAL_SESSION') && newSession?.user) {
          const u = newSession.user;
          void supabase.from('user_profiles').upsert(
            {
              user_id: u.id,
              display_name:
                (u.user_metadata?.full_name as string | undefined) ??
                (u.user_metadata?.name as string | undefined) ??
                u.email?.split('@')[0] ??
                null,
              email: u.email?.toLowerCase() ?? null,
              avatar_url:
                (u.user_metadata?.avatar_url as string | undefined) ||
                (u.user_metadata?.picture as string | undefined) ||
                null,
            },
            { onConflict: 'user_id' },
          );
        }
      },
    );

    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleDeepLink(url);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      sub.remove();
    };
  }, [handleDeepLink]);

  /**
   * Initiates Google OAuth via Supabase.
   *
   * Web: redirects the browser directly to Google using window.location.origin
   * as the callback URL — no popup, no localhost redirect.
   *
   * Native: opens an in-app browser via expo-web-browser with the app's deep-link
   * scheme as the redirect URI and processes the callback manually.
   */
  const signInWithGoogle = useCallback(async () => {
    if (Platform.OS === 'web') {
      // Use the current page origin so the OAuth callback returns to the same host.
      const redirectTo =
        typeof window !== 'undefined' ? window.location.origin : undefined;

      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      // The browser navigates away; nothing to do after this line.
      return;
    }

    // Native flow — deep-link back into the app.
    const redirectTo = AuthSession.makeRedirectUri({
      scheme: 'finduo',
      path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      console.error('Google sign-in error:', error?.message ?? 'No URL returned');
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === 'success' && result.url) {
      await handleDeepLink(result.url);
    }
  }, [handleDeepLink]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, avatarUrl, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Convenience hook – throws if used outside <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
