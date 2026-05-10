import React, { useEffect, useRef } from 'react';
import { Image, View } from 'react-native';
import { useDashboard } from '../../../context/DashboardContext';
import { styles } from '../../../screens/DashboardScreen.styles';
import DashboardHeader from './DashboardHeader';
import DashboardBody from './DashboardBody';
import ScrollTopFab from './ScrollTopFab';
import BottomActions from './BottomActions';
import PoolsSection from '../../sections/PoolsSection';
import LendingSection from '../../sections/LendingSection';
import SettlementsSection from '../../sections/SettlementsSection';
import ContactsSection from '../../sections/ContactsSection';
import { uiPath, uiProps } from '../../../lib/devtools';
import { registerBackHandler } from '../../../lib/capacitorBack';

export default function DashboardLayout() {
  const {
    loading,
    desktopView,
    framedMobileView,
    activeSection,
    setActiveSection,
    showAccountOverviewPicker,
    setShowAccountOverviewPicker,
  } = useDashboard();

  const activeSectionRef = useRef(activeSection);
  useEffect(() => { activeSectionRef.current = activeSection; });

  const overviewPickerRef = useRef(showAccountOverviewPicker);
  useEffect(() => { overviewPickerRef.current = showAccountOverviewPicker; });

  useEffect(() => registerBackHandler(() => {
    if (overviewPickerRef.current) {
      setShowAccountOverviewPicker(false);
      return true;
    }
    if (activeSectionRef.current !== null) {
      setActiveSection(null);
      return true;
    }
    return false;
  }), []);

  if (loading) {
    return (
      <View {...uiProps(uiPath('dashboard', 'layout', 'loading_container'))} style={styles.loadingWrap}>
        <Image
          {...uiProps(uiPath('dashboard', 'layout', 'loading_indicator'))}
          source={require('../../../../assets/fdstar.gif')}
          style={{ width: '100%', aspectRatio: 1 }}
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
          {activeSection === 'contacts' && <ContactsSection />}
          {!activeSection && (
            <>
              <DashboardBody />
              <ScrollTopFab />
              <BottomActions />
            </>
          )}
        </View>
      </View>
    </View>
  );
}
