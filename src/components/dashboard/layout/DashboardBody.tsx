import React, { useRef } from 'react';
import { PanResponder, View } from 'react-native';
import { useDashboard } from '../../../context/DashboardContext';
import { styles } from '../../../screens/DashboardScreen.styles';
import MainScrollView from './MainScrollView';
import DesktopSidebar from './DesktopSidebar';

export default function DashboardBody() {
  const {
    desktopView,
    includedAccountSummaries,
    setMenuOpen,
  } = useDashboard();

  const menuSwipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        gestureState.dx > 10 && Math.abs(gestureState.dy) < 30,
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dx > 50) {
          setMenuOpen(true);
        }
      },
    }),
  ).current;

  const hasSidebar = desktopView && includedAccountSummaries.length > 1;

  return (
    <View style={hasSidebar ? styles.desktopBodyWrapper : { flex: 1 }}>
      {/* Edge swipe zone to open menu on mobile */}
      {!desktopView && (
        <View
          {...menuSwipePanResponder.panHandlers}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 20, zIndex: 50 }}
        />
      )}
      <MainScrollView />
      {hasSidebar && <DesktopSidebar />}
    </View>
  );
}
