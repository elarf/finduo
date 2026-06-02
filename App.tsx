/**
 * App.tsx – application entry point.
 *
 * Wraps the entire app in:
 *  - QueryClientProvider : TanStack Query cache-first data layer
 *  - SafeAreaProvider    : provides safe-area insets to all child screens
 *  - AuthProvider        : manages Supabase session state globally
 *  - RootNavigator       : handles logged-in vs logged-out navigation
 */
import React, { useEffect } from 'react';
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
import { navigationRef, setPendingShortcut, getPendingShortcut, getPendingNotification, setPendingNotification, setLaunchReady } from './src/navigation/navigationRef';
import { setupNotificationActionListener, setupFinGoNotificationReceivedListener } from './src/lib/fingo/notifications';
import { setupTrackingActionListener } from './src/lib/fingo/trackingNotification';
import { setupFinMedChannels } from './src/lib/fingo/notifications';
import { setupIntakeNotificationActions, setupIntakeNotificationActionListener, setupIntakeNotificationReceivedListener } from './src/lib/finmed/notifications';
import { navigationRef as navRef } from './src/navigation/navigationRef';

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
      setPendingShortcut(null);
      break;
    case 'fingo':
      navigationRef.navigate('FinGo');
      setPendingShortcut(null);
      break;
    case 'finhub':
    case 'tracking':
      navigationRef.navigate('FinHub');
      setPendingShortcut(null);
      break;
    default:
      setPendingShortcut(null);
      return false;
  }
  return true;
}

export default function App() {
  useEffect(() => {
    setupNotificationActionListener();
    setupFinGoNotificationReceivedListener();
    setupTrackingActionListener();
    void setupFinMedChannels();
    void setupIntakeNotificationActions();

    // Setup FinMed notification action handlers
    setupIntakeNotificationActionListener(
      (reminderId, slotIndex) => {
        // Handle "Taken" action - navigate to FinMed and trigger completion
        console.log('[App] Taken action:', { reminderId, slotIndex });
        if (navigationRef.isReady()) {
          navigationRef.navigate('FinMed', { action: 'taken', reminderId, slotIndex });
        }
      },
      (reminderId, slotIndex) => {
        // Handle "Snooze" action - navigate to FinMed and show snooze sheet
        console.log('[App] Snooze action:', { reminderId, slotIndex });
        if (navigationRef.isReady()) {
          navigationRef.navigate('FinMed', { action: 'snooze', reminderId, slotIndex });
        }
      },
      (reminderId, slotIndex) => {
        // Handle "Tap" action - navigate to FinMed screen
        console.log('[App] Tap action:', { reminderId, slotIndex });
        if (navigationRef.isReady()) {
          navigationRef.navigate('FinMed');
        }
      },
    );
    setupIntakeNotificationReceivedListener();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setLaunchReady(); // no launch URL to wait for on web
      return;
    }

    const handleShortcutUrl = (url: string) => {
      if (!url.includes('://shortcut/')) return;
      const id = url.split('://shortcut/')[1];
      setPendingShortcut(id);
    };

    // Cold start: app launched from shortcut tap
    void CapacitorApp.getLaunchUrl().then(result => {
      if (result?.url) handleShortcutUrl(result.url);
    }).finally(() => {
      setLaunchReady();
    });

    // Warm start: app already running when shortcut tapped
    let removeListener: (() => void) | undefined;
    void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      handleShortcutUrl(url);
    }).then(handle => { removeListener = () => handle.remove(); });

    return () => removeListener?.();
  }, []);

  // Route any pending shortcut or notification once nav is ready
  useEffect(() => {
    const interval = setInterval(() => {
      if (!navigationRef.isReady()) return;

      const shortcut = getPendingShortcut();
      if (shortcut) {
        routeShortcut(shortcut);
      }

      const notif = getPendingNotification();
      if (notif) {
        navigationRef.navigate('ServiceIntervalDetail', {
          intervalId: notif.intervalId,
          componentId: notif.componentId,
          assetId: notif.assetId,
        });
        setPendingNotification(null);
      }

      if (!getPendingShortcut() && !getPendingNotification()) {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

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
