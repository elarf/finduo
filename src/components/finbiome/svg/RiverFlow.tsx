/**
 * RiverFlow SVG Component
 *
 * Vertical stream path from tree's merged roots to bottom.
 */
import React from 'react';
import { Path } from 'react-native-svg';
import type { Point2D } from '../../../lib/finbiome/types2D';
import { generateSmoothPath } from '../../../lib/finbiome/svgHelpers';

interface RiverFlowProps {
  streamPath: Point2D[];
  width: number;
  color: string;
}

export default function RiverFlow({ streamPath, width, color }: RiverFlowProps) {
  const pathData = generateSmoothPath(streamPath);

  return (
    <Path
      d={pathData}
      stroke={color}
      strokeWidth={width}
      fill="none"
      opacity={0.6}
      strokeLinecap="round"
    />
  );
}
