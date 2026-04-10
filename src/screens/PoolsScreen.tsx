import React from 'react';
import { View } from 'react-native';
import PoolsSection from '../components/sections/PoolsSection';

export default function PoolsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <PoolsSection />
    </View>
  );
}
