import React from 'react';
import { View } from 'react-native';
import SettlementsSection from '../components/sections/SettlementsSection';

export default function SettlementsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <SettlementsSection />
    </View>
  );
}
