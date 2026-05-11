import React from 'react';
import {
  Zap, Droplets, SlidersHorizontal, Gauge, Package,
  Filter, Thermometer, Eye, Wrench, Settings, Battery,
  Lightbulb, Box,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { BikeIcon, BIKE_ICON_NAMES } from './BikeIcons';
import type { BikeIconName } from './BikeIcons';

const LUCIDE_MAP: Record<string, LucideIcon> = {
  zap:        Zap,
  droplets:   Droplets,
  sliders:    SlidersHorizontal,
  gauge:      Gauge,
  package:    Package,
  filter:     Filter,
  thermometer: Thermometer,
  eye:        Eye,
  wrench:     Wrench,
  settings:   Settings,
  battery:    Battery,
  lightbulb:  Lightbulb,
  box:        Box,
};

interface Props {
  name: string;
  size?: number;
  color?: string;
}

export default function ComponentIcon({ name, size = 16, color = '#3B6A9E' }: Props) {
  if (BIKE_ICON_NAMES.has(name)) {
    return <BikeIcon name={name as BikeIconName} size={size} color={color} />;
  }
  const Icon = LUCIDE_MAP[name] ?? Box;
  return <Icon size={size} color={color} />;
}
