import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useDashboard } from '../../../context/DashboardContext';
import Icon from '../../Icon';
import { styles } from '../../../screens/DashboardScreen.styles';

export default function ScrollTopFab() {
  const { scrollY, mainScrollRef } = useDashboard();

  if (scrollY <= 320) return null;

  return (
    <TouchableOpacity
      style={styles.scrollTopFab}
      onPress={() => mainScrollRef.current?.scrollTo({ y: 0, animated: true })}
      accessibilityLabel="Scroll to top"
    >
      <Icon name="arrow_up" size={22} color="#060A14" />
    </TouchableOpacity>
  );
}
