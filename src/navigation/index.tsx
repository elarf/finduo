/**
 * Root navigation.
 *
 * Shows the LoginScreen when there is no authenticated session and the
 * DashboardScreen once the user is signed in.  The navigator automatically
 * re-renders when the session state changes inside AuthProvider.
 */
import React from 'react';
import { Image, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import FinBiomeScreen from '../screens/FinBiomeScreen';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: { prefillEntry?: object } | undefined;
  FinBiome: undefined;
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
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="FinBiome" component={FinBiomeScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
