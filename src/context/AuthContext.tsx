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
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapacitorApp } from '@capacitor/app';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthContextValue } from '../types/auth';

// Required so the browser tab can redirect back to the app on iOS / Android.
WebBrowser.maybeCompleteAuthSession();

// Deep-link scheme used by the Capacitor APK build.
const CAPACITOR_REDIRECT = 'com.finduo.fingo://auth/callback';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Normalise the Google avatar — OAuth may populate either avatar_url or picture,
  // and sometimes only identity_data has it (e.g. first sign-in before profile was public).
  const avatarUrl: string | null =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    (user?.identities?.[0]?.identity_data?.avatar_url as string | undefined) ||
    (user?.identities?.[0]?.identity_data?.picture as string | undefined) ||
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
        // On Capacitor, use App.getLaunchUrl() to catch cold-start deep links.
        Capacitor.isNativePlatform()
          ? CapacitorApp.getLaunchUrl().then(r => r?.url ?? null)
          : Linking.getInitialURL(),
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

          // Extract avatar URL — check user_metadata first, then raw identity_data
          // (Supabase sometimes omits avatar_url from user_metadata on first sign-in
          // but the original provider payload in identities[0] usually has it)
          const newAvatarUrl =
            (u.user_metadata?.avatar_url as string | undefined) ||
            (u.user_metadata?.picture as string | undefined) ||
            (u.identities?.[0]?.identity_data?.avatar_url as string | undefined) ||
            (u.identities?.[0]?.identity_data?.picture as string | undefined) ||
            null;

          // Build upsert data - only include avatar_url if we have a new one
          const upsertData: any = {
            user_id: u.id,
            display_name:
              (u.user_metadata?.full_name as string | undefined) ??
              (u.user_metadata?.name as string | undefined) ??
              u.email?.split('@')[0] ??
              null,
            email: u.email?.toLowerCase() ?? null,
          };

          // Only update avatar_url if we have a new one from OAuth
          // This prevents overwriting existing avatars with null
          if (newAvatarUrl) {
            upsertData.avatar_url = newAvatarUrl;
          }

          void supabase.from('user_profiles').upsert(upsertData, { onConflict: 'user_id' }).then(({ error }) => {
            if (error) console.error('[AuthContext] user_profiles upsert failed:', error.message);
          });
        }
      },
    );

    // Expo Linking listener (PWA / Expo native builds).
    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleDeepLink(url);
    });

    // Capacitor App plugin listener for deep-link callbacks (APK builds).
    // Chrome Custom Tab automatically closes when the intent is received.
    let removeCapacitorListener: (() => void) | null = null;
    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
        await Browser.close();
        await handleDeepLink(url);
      }).then(handle => {
        removeCapacitorListener = () => void handle.remove();
      });
    }

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      sub.remove();
      removeCapacitorListener?.();
    };
  }, [handleDeepLink]);

  /**
   * Initiates Google OAuth via Supabase.
   *
   * Web/PWA: redirects the browser directly — no popup, no localhost redirect.
   *
   * Capacitor (APK): opens a Chrome Custom Tab via @capacitor/browser with the
   * app's custom URL scheme as the redirect URI. The tab closes automatically
   * when Android intercepts the deep link and fires appUrlOpen.
   *
   * Expo native: falls back to expo-web-browser in-app browser session.
   */
  const signInWithGoogle = useCallback(async () => {
    // Capacitor native APK — Chrome Custom Tab + deep-link redirect
    if (Capacitor.isNativePlatform()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: CAPACITOR_REDIRECT,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        console.error('Google sign-in error:', error?.message ?? 'No URL returned');
        return;
      }

      await Browser.open({ url: data.url });
      // Deep-link callback is handled by the appUrlOpen listener in useEffect.
      return;
    }

    // Web browser / PWA — redirect the current tab to Google and back.
    if (typeof window !== 'undefined') {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      return;
    }

    // Expo native fallback (expo run:android / iOS) — in-app browser session.
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
