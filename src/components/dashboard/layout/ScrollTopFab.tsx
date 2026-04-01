import React from 'react';
import { TouchableOpacity } from 'react-native';
import { logUI, uiPath, uiProps } from '../../../lib/devtools';
import { useDashboard } from '../../../context/DashboardContext';
import Icon from '../../Icon';
import { styles } from '../../../screens/DashboardScreen.styles';

export default function ScrollTopFab() {
  const { scrollY, mainScrollRef } = useDashboard();

  if (scrollY <= 320) return null;

  return (
    <TouchableOpacity
      style={styles.scrollTopFab}
      onPress={() => {
        logUI(uiPath('dashboard', 'scroll_top_fab', 'button'), 'press');
        mainScrollRef.current?.scrollTo({ y: 0, animated: true });
      }}
      accessibilityLabel="Scroll to top"
      {...uiProps(uiPath('dashboard', 'scroll_top_fab', 'button'))}
    >
      <Icon name="arrow_up" size={22} color="#060A14" />
    </TouchableOpacity>
  );
}
