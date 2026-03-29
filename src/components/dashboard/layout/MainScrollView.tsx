import React from 'react';
import { ScrollView, Text, View } from 'react-native';
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
  } = useDashboard();

  return (
    <ScrollView
      ref={mainScrollRef}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
      contentContainerStyle={styles.scrollContent}
      onScroll={handleDashboardScroll}
      scrollEventThrottle={16}
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
