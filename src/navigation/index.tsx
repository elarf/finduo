import React from 'react';
import { Image, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { DashboardProvider } from '../context/DashboardContext';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import FinBiomeScreen from '../screens/FinBiomeScreen';
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

export type RootStackParamList = {
  // Auth
  Login: undefined;

  // Main screens
  Dashboard: { prefillEntry?: object } | undefined;
  FinBiome: undefined;

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
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' }}>
        <Image
          source={require('../../assets/spinnerSMALL.gif')}
          style={{ width: 80, height: 80 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? (
        <DashboardProvider>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {/* Main screens */}
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="FinBiome" component={FinBiomeScreen} />

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
          </Stack.Navigator>
        </DashboardProvider>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
