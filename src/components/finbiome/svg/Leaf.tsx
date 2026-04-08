/**
 * Leaf SVG Component
 *
 * Circle representing individual transaction.
 */
import React from 'react';
import { Circle } from 'react-native-svg';
import type { Point2D } from '../../../lib/finbiome/types2D';

interface LeafProps {
  center: Point2D;
  radius: number;
  color: string;
}

export default function Leaf({ center, radius, color }: LeafProps) {
  return (
    <Circle
      cx={center.x}
      cy={center.y}
      r={radius}
      fill={color}
      opacity={0.8}
    />
  );
}
