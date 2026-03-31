/**
 * App.tsx – application entry point.
 *
 * Wraps the entire app in:
 *  - QueryClientProvider : TanStack Query cache-first data layer
 *  - SafeAreaProvider    : provides safe-area insets to all child screens
 *  - AuthProvider        : manages Supabase session state globally
 *  - RootNavigator       : handles logged-in vs logged-out navigation
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 minutes: cached data served instantly on reopen
      gcTime: 60 * 60 * 1000,     // 1 hour: keep unused cache in memory
      refetchOnWindowFocus: false, // no surprise refetches on tab switch / app resume
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
