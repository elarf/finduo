import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { topInset, bottomInset } from '../lib/safeArea';
import SettlementsSection from '../components/sections/SettlementsSection';

export default function SettlementsScreen() {
  const { top, bottom } = useSafeAreaInsets();
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#000000',
      paddingTop: topInset(0, top),
      paddingBottom: bottomInset(0, bottom),
    }}>
      <SettlementsSection />
    </View>
  );
}
