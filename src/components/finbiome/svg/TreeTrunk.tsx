/**
 * TreeTrunk SVG Component
 *
 * Placeholder rectangle representing account trunk (root node).
 */
import React from 'react';
import { Rect } from 'react-native-svg';

interface TreeTrunkProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export default function TreeTrunk({ x, y, width, height, color }: TreeTrunkProps) {
  return (
    <Rect
      x={x - width / 2} // Center on x
      y={y}
      width={width}
      height={height}
      fill={color}
      rx={4} // Rounded corners
      opacity={0.9}
    />
  );
}
