/**
 * Icon – native implementation.
 * Falls back to @expo/vector-icons MaterialIcons for iOS / Android.
 */
import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: object;
}

export default function Icon({ name, size = 24, color = '#EAF2FF', style }: IconProps) {
  return <MaterialIcons name={name as any} size={size} color={color} style={style} />;
}
