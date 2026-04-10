import React from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { logUI, uiPath, uiProps } from '../../../lib/devtools';
import { useDashboard } from '../../../context/DashboardContext';

export default function ScrollTopFab() {
  const { scrollY, mainScrollRef } = useDashboard();

  if (scrollY <= 320) return null;

  return (
    <TouchableOpacity
      style={{ position: 'absolute', right: 100, bottom: 130 }}
      onPress={() => {
        logUI(uiPath('dashboard', 'scroll_top_fab', 'button'), 'press');
        mainScrollRef.current?.scrollTo({ y: 0, animated: true });
      }}
      accessibilityLabel="Scroll to top"
      {...uiProps(uiPath('dashboard', 'scroll_top_fab', 'button'))}
    >
      <Image
        source={require('../../../../assets/tothetop.png')}
        style={{ width: 56, height: 56 }}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}
