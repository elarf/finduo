/**
 * BackgroundLayer Component
 *
 * Static gradient background (Layer 1, zIndex: 1).
 * No interaction or panning.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function BackgroundLayer() {
  return (
    <LinearGradient
      colors={['#07090F', '#0a1020', '#0D152A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
