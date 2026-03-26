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
   * Initiates Google OAuth via Supabase using expo-auth-session.
    * The redirect URL is generated per runtime (Expo Go vs native scheme)
    * so the callback can return to this app in development and production.
   */
  const signInWithGoogle = useCallback(async () => {
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
    <AuthContext.Provider value={{ session, user, loading, signInWithGoogle, signOut }}>
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
