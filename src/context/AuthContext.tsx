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

  // Listen for Supabase auth state changes and persist them.
  useEffect(() => {
    // Get the existing session on mount.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  /**
   * Initiates Google OAuth via Supabase using expo-auth-session.
   * The redirect URL is built from the Expo proxy so it works in Expo Go
   * as well as standalone builds.
   */
  const signInWithGoogle = useCallback(async () => {
    const redirectTo = AuthSession.makeRedirectUri({ scheme: 'finduo' });

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
      const url = new URL(result.url);
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');

      if (accessToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? '',
        });
      }
    }
  }, []);

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
