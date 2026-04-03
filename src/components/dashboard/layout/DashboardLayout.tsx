import React from 'react';
import { Image, View } from 'react-native';
import { useDashboard } from '../../../context/DashboardContext';
import { styles } from '../../../screens/DashboardScreen.styles';
import DashboardHeader from './DashboardHeader';
import DashboardBody from './DashboardBody';
import ScrollTopFab from './ScrollTopFab';
import BottomActions from './BottomActions';
import ModalsRoot from './ModalsRoot';
import PoolsSection from '../../sections/PoolsSection';
import LendingSection from '../../sections/LendingSection';
import SettlementsSection from '../../sections/SettlementsSection';
import { uiPath, uiProps } from '../../../lib/devtools';

export default function DashboardLayout() {
  const {
    loading,
    desktopView,
    framedMobileView,
    activeSection,
  } = useDashboard();

  if (loading) {
    return (
      <View {...uiProps(uiPath('dashboard', 'layout', 'loading_container'))} style={styles.loadingWrap}>
        <Image
          {...uiProps(uiPath('dashboard', 'layout', 'loading_indicator'))}
          source={require('../../../../assets/spinnerFAST.gif')}
          style={{ width: 120, height: 120 }}
          resizeMode="contain"
        />
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
          {activeSection === 'pools' && <PoolsSection />}
          {activeSection === 'lending' && <LendingSection />}
          {activeSection === 'settlements' && <SettlementsSection />}
          {!activeSection && (
            <>
              <DashboardBody />
              <ScrollTopFab />
              <BottomActions />
            </>
          )}
        </View>
      </View>
      <ModalsRoot />
    </View>
  );
}
