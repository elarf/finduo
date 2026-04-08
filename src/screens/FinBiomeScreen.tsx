/**
 * FinBiome Screen
 *
 * A 2D layered SVG visualization system.
 * Features: FinTree - hierarchical financial trees with horizontal scrolling.
 */
import React from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DashboardHeader from '../components/dashboard/layout/DashboardHeader';
import { DashboardProvider, useDashboard } from '../context/DashboardContext';
import { FinBiomeProvider } from '../context/FinBiomeContext';
import FinBiomeCanvas from '../components/finbiome/FinBiomeCanvas';

function FinBiomeContent() {
  const navigation = useNavigation();
  const { accounts, selectedAccountId } = useDashboard();

  // Fallback for native platforms
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <DashboardHeader onBack={() => navigation.goBack()} />
        </View>
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            FinBiome is available on web.{'\n'}
            Open finduo.app in your browser.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <DashboardHeader onBack={() => navigation.goBack()} />
      </View>
      <View style={styles.canvasWrapper}>
        <FinBiomeCanvas />
      </View>
    </View>
  );
}

// Wrapper component with DashboardProvider and FinBiomeProvider
export default function FinBiomeScreen() {
  return (
    <DashboardProvider>
      <FinBiomeProvider>
        <FinBiomeContent />
      </FinBiomeProvider>
    </DashboardProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07090F',
    overflow: 'hidden',
  },
  header: {
    zIndex: 1000,
    backgroundColor: '#07090F',
  },
  canvasWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fallbackText: {
    color: '#00F5D4',
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'DM Sans',
  },
});
