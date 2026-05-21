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
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './src/context/AuthContext';

let AppShortcuts: any;
if (Platform.OS === 'android') {
  try {
    AppShortcuts = require('@capacitor-community/app-shortcuts').AppShortcuts;
  } catch (e) {
    console.warn('AppShortcuts not available');
  }
}
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
    if (Platform.OS !== 'android') return;

    AppShortcuts.setShortcuts({
      shortcuts: [
        { id: 'add_expense', title: 'Add Expense', shortTitle: 'Expense', icon: 'shortcut_add_expense' },
        { id: 'fingo',       title: 'FinGo',       shortTitle: 'FinGo',   icon: 'shortcut_fingo'       },
      ],
    }).catch(() => {});

    let removeListener: (() => void) | undefined;
    AppShortcuts.addListener('shortcut', ({ shortcutId }: { shortcutId: string }) => {
      if (!routeShortcut(shortcutId)) {
        // Navigation not ready yet (cold start) — retry once it is
        pendingShortcutRef.current = shortcutId;
      }
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
