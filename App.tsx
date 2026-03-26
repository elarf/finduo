/**
 * App.tsx – application entry point.
 *
 * Wraps the entire app in:
 *  - SafeAreaProvider  : provides safe-area insets to all child screens
 *  - AuthProvider      : manages Supabase session state globally
 *  - RootNavigator     : handles logged-in vs logged-out navigation
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
