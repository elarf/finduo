import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useDashboard } from '../../../context/DashboardContext';
import { styles } from '../../../screens/DashboardScreen.styles';
import DashboardHeader from './DashboardHeader';
import DashboardBody from './DashboardBody';
import ScrollTopFab from './ScrollTopFab';
import BottomActions from './BottomActions';
import ModalsRoot from './ModalsRoot';

export default function DashboardLayout() {
  const {
    loading,
    desktopView,
    framedMobileView,
  } = useDashboard();

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        {!desktopView ? (
          <Image
            source={require('../../../../assets/logo.png')}
            style={{ width: '100%', height: 80, marginBottom: 24 }}
            resizeMode="contain"
          />
        ) : null}
        <ActivityIndicator size="large" color="#53E3A6" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.appShell}>
      <View
        style={[
          styles.surfaceFrame,
          desktopView && styles.surfaceFrameDesktop,
          framedMobileView && styles.surfaceFrameMobile,
        ]}
      >
        <View style={styles.container}>
          <DashboardHeader />
          <DashboardBody />
          <ScrollTopFab />
          <BottomActions />
        </View>
      </View>
      <ModalsRoot />
    </View>
  );
}
