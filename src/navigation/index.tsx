import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { navigationRef, isLaunchReady, getPendingShortcut, setPendingShortcut } from './navigationRef';
import { initCapacitorBackButton } from '../lib/capacitorBack';
import { useAuth } from '../context/AuthContext';
import { DashboardProvider } from '../context/DashboardContext';
import { NotificationCenterProvider } from '../context/NotificationCenterContext';
import { fetchAssets, fingoAssetsQueryKey } from '../hooks/useAssets';
import { useHCAutoSync } from '../hooks/useHCAutoSync';
import NotificationHistorySheet from '../components/notifications/NotificationHistorySheet';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import FinHubScreen from '../screens/FinHubScreen';
import FinGoScreen from '../screens/FinGoScreen';
import FinMedScreen from '../screens/FinMedScreen';
import FinVenScreen from '../screens/FinVenScreen';
import EntryScreen from '../screens/EntryScreen';
import CategoryScreen from '../screens/CategoryScreen';
import TagScreen from '../screens/TagScreen';
import AccountScreen from '../screens/AccountScreen';
import TransferScreen from '../screens/TransferScreen';
import InvitationsScreen from '../screens/InvitationsScreen';
import FriendsScreen from '../screens/FriendsScreen';
import QuickNavScreen from '../screens/QuickNavScreen';
import PoolsScreen from '../screens/PoolsScreen';
import LendingScreen from '../screens/LendingScreen';
import SettlementsScreen from '../screens/SettlementsScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ComponentDetailScreen from '../screens/ComponentDetailScreen';
import ServiceIntervalDetailScreen from '../screens/ServiceIntervalDetailScreen';
import HealthConnectScreen from '../screens/HealthConnectScreen';
import TrackingShortcutScreen from '../screens/TrackingShortcutScreen';
import JourneyScreen from '../screens/JourneyScreen';
import JourneyDetailScreen from '../screens/JourneyDetailScreen';

export type RootStackParamList = {
  // Auth
  Login: undefined;

  // Main screens
  Dashboard: { prefillEntry?: { type: 'expense' | 'income' } } | undefined;
  FinHub: undefined;
  FinBiome: undefined;
  FinGo: undefined;
  FinMed: { action?: 'taken' | 'snooze'; reminderId?: string; slotIndex?: number } | undefined;
  FinVen: undefined;

  // Modal screens
  Entry: { transactionId?: string } | undefined;
  Category: { categoryId?: string } | undefined;
  Tag: { tagId?: string } | undefined;
  Account: { accountId?: string } | undefined;
  Transfer: undefined;
  Invitations: undefined;
  Friends: undefined;
  QuickNav: undefined;

  // FinOps section screens
  Pools: undefined;
  Lending: undefined;
  Settlements: undefined;
  Contacts: undefined;

  // FinGo detail screens
  ComponentDetail: { componentId: string; assetId: string };
  ServiceIntervalDetail: { intervalId: string; componentId: string; assetId: string };
  HealthConnect: undefined;

  // GPS tracking
  TrackingShortcut: undefined;
  Journey: undefined;
  JourneyDetail: { sessionId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { session, loading } = useAuth();
  const queryClient = useQueryClient();
  const [appReady, setAppReady] = useState(false);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Run HC auto-sync at app level (not screen-specific) so it works on all screens
  useHCAutoSync();

  useEffect(() => {
    initCapacitorBackButton();
  }, []);

  useEffect(() => {
    if (loading) return;

    let cancelled = false;

    const check = () => {
      if (cancelled) return;

      if (!isLaunchReady()) {
        checkTimerRef.current = setTimeout(check, 20);
        return;
      }

      const shortcut = getPendingShortcut();
      const userId = session?.user?.id;

      if (shortcut === 'fingo' && userId) {
        const cached = queryClient.getQueryData(fingoAssetsQueryKey(userId));
        if (cached) {
          setAppReady(true);
        } else {
          void queryClient.prefetchQuery({
            queryKey: fingoAssetsQueryKey(userId),
            queryFn: () => fetchAssets(userId),
          }).finally(() => {
            if (!cancelled) setAppReady(true);
          });
        }
      } else {
        setAppReady(true);
      }
    };

    check();

    return () => {
      cancelled = true;
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, [loading, session, queryClient]);

  // Route any pending shortcut the moment navigation becomes ready, eliminating
  // the brief Dashboard flash that occurred when the routing interval fired late.
  const handleNavigationReady = useCallback(() => {
    const shortcut = getPendingShortcut();
    if (!shortcut) return;
    switch (shortcut) {
      case 'add_expense':
        navigationRef.navigate('Dashboard', { prefillEntry: { type: 'expense' } });
        break;
      case 'fingo':
        navigationRef.navigate('FinGo');
        break;
      case 'finhub':
      case 'tracking':
        navigationRef.navigate('FinHub');
        break;
    }
    setPendingShortcut(null);
  }, []);

  if (loading || !appReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' }}>
        <Image
          source={require('../../assets/fdstar.gif')}
          style={{ width: '100%' }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
      {session ? (
        <NotificationCenterProvider>
          <DashboardProvider>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              {/* Main screens */}
              <Stack.Screen name="Dashboard" component={DashboardScreen} />
              <Stack.Screen name="FinHub" component={FinHubScreen} />
              <Stack.Screen name="FinBiome" component={FinHubScreen} />
              <Stack.Screen name="FinGo" component={FinGoScreen} />
              <Stack.Screen name="FinMed" component={FinMedScreen} />
              <Stack.Screen name="FinVen" component={FinVenScreen} />

              {/* Modal screens - presentation handled per-platform */}
              <Stack.Group screenOptions={{
                presentation: 'transparentModal',
                animation: 'slide_from_bottom',
              }}>
                <Stack.Screen name="Entry" component={EntryScreen} />
                <Stack.Screen name="Category" component={CategoryScreen} />
                <Stack.Screen name="Tag" component={TagScreen} />
                <Stack.Screen name="Account" component={AccountScreen} />
                <Stack.Screen name="Transfer" component={TransferScreen} />
                <Stack.Screen name="Invitations" component={InvitationsScreen} />
                <Stack.Screen name="Friends" component={FriendsScreen} />
                <Stack.Screen name="QuickNav" component={QuickNavScreen} />
              </Stack.Group>

              {/* FinOps section screens */}
              <Stack.Screen name="Pools" component={PoolsScreen} />
              <Stack.Screen name="Lending" component={LendingScreen} />
              <Stack.Screen name="Settlements" component={SettlementsScreen} />
              <Stack.Screen name="Contacts" component={ContactsScreen} />

              {/* FinGo detail screens */}
              <Stack.Screen name="ComponentDetail" component={ComponentDetailScreen} />
              <Stack.Screen name="ServiceIntervalDetail" component={ServiceIntervalDetailScreen} />
              <Stack.Screen name="HealthConnect" component={HealthConnectScreen} />

              {/* GPS tracking */}
              <Stack.Screen name="TrackingShortcut" component={TrackingShortcutScreen} />
              <Stack.Screen name="Journey" component={JourneyScreen} />
              <Stack.Screen name="JourneyDetail" component={JourneyDetailScreen} />
            </Stack.Navigator>
            <NotificationHistorySheet />
          </DashboardProvider>
        </NotificationCenterProvider>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
