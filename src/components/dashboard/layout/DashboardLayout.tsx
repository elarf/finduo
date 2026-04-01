import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useDashboard } from '../../../context/DashboardContext';
import { styles } from '../../../screens/DashboardScreen.styles';
import DashboardHeader from './DashboardHeader';
import DashboardBody from './DashboardBody';
import ScrollTopFab from './ScrollTopFab';
import BottomActions from './BottomActions';
import ModalsRoot from './ModalsRoot';
import { uiPath, uiProps } from '../../../lib/devtools';

export default function DashboardLayout() {
  const {
    loading,
    desktopView,
    framedMobileView,
  } = useDashboard();

  if (loading) {
    return (
      <View {...uiProps(uiPath('dashboard', 'layout', 'loading_container'))} style={styles.loadingWrap}>
        {!desktopView ? (
          <Image
            {...uiProps(uiPath('dashboard', 'layout', 'loading_logo'))}
            source={require('../../../../assets/logo.png')}
            style={{ width: '100%', height: 80, marginBottom: 24 }}
            resizeMode="contain"
          />
        ) : null}
        <ActivityIndicator {...uiProps(uiPath('dashboard', 'layout', 'loading_indicator'))} size="large" color="#53E3A6" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View {...uiProps(uiPath('dashboard', 'layout', 'main_container'))} style={styles.appShell}>
      <View
        {...uiProps(uiPath('dashboard', 'layout', 'surface_frame'))}
        style={[
          styles.surfaceFrame,
          desktopView && styles.surfaceFrameDesktop,
          framedMobileView && styles.surfaceFrameMobile,
        ]}
      >
        <View {...uiProps(uiPath('dashboard', 'layout', 'inner_container'))} style={styles.container}>
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
