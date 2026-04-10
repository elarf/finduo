import React from 'react';
import { View } from 'react-native';
import { useDashboard } from '../../../context/DashboardContext';
import { styles } from '../../../screens/DashboardScreen.styles';
import MainScrollView from './MainScrollView';
import DesktopSidebar from './DesktopSidebar';

export default function DashboardBody() {
  const {
    desktopView,
    includedAccountSummaries,
  } = useDashboard();

  const hasSidebar = desktopView && includedAccountSummaries.length > 1;

  return (
    <View style={hasSidebar ? styles.desktopBodyWrapper : { flex: 1 }}>
      <MainScrollView />
      {hasSidebar && <DesktopSidebar />}
    </View>
  );
}
