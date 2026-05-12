import React from 'react';
import { Image } from 'react-native';
import {
  Zap, Droplets, SlidersHorizontal, Gauge, Package,
  Filter, Thermometer, Eye, Wrench, Settings,
  Lightbulb, Box,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { BikeIcon, BIKE_ICON_NAMES } from './BikeIcons';
import type { BikeIconName } from './BikeIcons';
import { FINGO_ASSETS } from '../../lib/fingo/fingoAssets';

const PNG_MAP: Record<string, any> = {
  battery:       FINGO_ASSETS.battery,
  cassette:      FINGO_ASSETS.cassette,
  chain:         FINGO_ASSETS.chain,
  chainring:     FINGO_ASSETS.chainring,
  charge:        FINGO_ASSETS.charge,
  cleatless:     FINGO_ASSETS.cleatless,
  crank:         FINGO_ASSETS.crank,
  derailleur:    FINGO_ASSETS.derailleur,
  discpads:      FINGO_ASSETS.discpads,
  fork:          FINGO_ASSETS.fork,
  frame:         FINGO_ASSETS.frame,
  handlebar:     FINGO_ASSETS.handlebar,
  pressure:      FINGO_ASSETS.pressure,
  'brake-rotor': FINGO_ASSETS.rotor,
  tube:          FINGO_ASSETS.tube,
  tyre:          FINGO_ASSETS.tyre,
  wheel:         FINGO_ASSETS.wheel,
};

const LUCIDE_MAP: Record<string, LucideIcon> = {
  zap:         Zap,
  droplets:    Droplets,
  sliders:     SlidersHorizontal,
  gauge:       Gauge,
  package:     Package,
  filter:      Filter,
  thermometer: Thermometer,
  eye:         Eye,
  wrench:      Wrench,
  settings:    Settings,
  lightbulb:   Lightbulb,
  box:         Box,
};

interface Props {
  name: string;
  size?: number;
  color?: string;
  stretch?: boolean;
}

export default function ComponentIcon({ name, size = 16, color = '#3B6A9E', stretch = false }: Props) {
  const pngSource = PNG_MAP[name];
  if (pngSource) {
    return (
      <Image
        source={pngSource}
        style={stretch ? { width: size, height: '100%' } : { width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  if (BIKE_ICON_NAMES.has(name)) {
    return <BikeIcon name={name as BikeIconName} size={size} color={color} />;
  }
  const Icon = LUCIDE_MAP[name] ?? Box;
  return <Icon size={size} color={color} />;
}
