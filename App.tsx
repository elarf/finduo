/**
 * App.tsx – application entry point.
 *
 * Wraps the entire app in:
 *  - QueryClientProvider : TanStack Query cache-first data layer
 *  - SafeAreaProvider    : provides safe-area insets to all child screens
 *  - AuthProvider        : manages Supabase session state globally
 *  - RootNavigator       : handles logged-in vs logged-out navigation
 */
import React, { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation';
import { navigationRef } from './src/navigation/navigationRef';
import { setupNotificationActionListener } from './src/lib/fingo/notifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000, // 24h: persisted cache survives full app restarts
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'FINDUO_QUERY_CACHE',
  throttleTime: 1000, // debounce writes to AsyncStorage
});

function routeShortcut(shortcutId: string) {
  if (!navigationRef.isReady()) return false;
  switch (shortcutId) {
    case 'add_expense':
      navigationRef.navigate('Dashboard', { prefillEntry: { type: 'expense' } });
      break;
    case 'fingo':
      navigationRef.navigate('FinGo');
      break;
  }
  return true;
}

export default function App() {
  const pendingShortcutRef = useRef<string | null>(null);

  useEffect(() => {
    setupNotificationActionListener();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleShortcutUrl = (url: string) => {
      if (!url.includes('://shortcut/')) return;
      const id = url.split('://shortcut/')[1];
      if (!routeShortcut(id)) {
        pendingShortcutRef.current = id;
      }
    };

    // Cold start: app launched from shortcut tap
    void CapacitorApp.getLaunchUrl().then(result => {
      if (result?.url) handleShortcutUrl(result.url);
    });

    // Warm start: app already running when shortcut tapped
    let removeListener: (() => void) | undefined;
    void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      handleShortcutUrl(url);
    }).then(handle => { removeListener = () => handle.remove(); });

    return () => removeListener?.();
  }, []);

  // Drain pending shortcut once the NavigationContainer is ready
  useEffect(() => {
    if (!pendingShortcutRef.current) return;
    const interval = setInterval(() => {
      const pending = pendingShortcutRef.current;
      if (pending && routeShortcut(pending)) {
        pendingShortcutRef.current = null;
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
    >
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}
