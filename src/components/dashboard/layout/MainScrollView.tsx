import React, { useCallback, useState } from 'react';
import { Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useDashboard } from '../../../context/DashboardContext';
import { styles } from '../../../screens/DashboardScreen.styles';
import OverviewCard from '../boxes/OverviewCard';
import SpendingChart from '../boxes/SpendingChart';
import CategoriesRow from '../boxes/CategoriesRow';
import TransactionSection from '../boxes/TransactionSection';

export default function MainScrollView() {
  const {
    mainScrollRef,
    handleDashboardScroll,
    missingSchemaColumns,
    reloadDashboard,
  } = useDashboard();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      await reloadDashboard();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, reloadDashboard]);

  return (
    <ScrollView
      ref={mainScrollRef}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
      onScroll={handleDashboardScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#ffffff"
          colors={['#ffffff']}
          progressBackgroundColor="#0D1B2E"
        />
      }
    >
      {missingSchemaColumns.length > 0 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningBannerTitle}>Database update needed</Text>
          <Text style={styles.warningBannerText}>
            Missing columns: {missingSchemaColumns.join(', ')}
          </Text>
          <Text style={styles.warningBannerText}>
            Run migration: supabase/migrations/20260326_add_carry_over_and_invite_name.sql
          </Text>
        </View>
      )}
      <OverviewCard />
      <SpendingChart />
      <CategoriesRow />
      <TransactionSection />
    </ScrollView>
  );
}
