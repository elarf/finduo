/**
 * Branch SVG Component
 *
 * Line connecting trunk to category branch node.
 */
import React from 'react';
import { Path } from 'react-native-svg';
import type { Point2D } from '../../../lib/finbiome/types2D';
import { generateLinePath } from '../../../lib/finbiome/svgHelpers';

interface BranchProps {
  startPoint: Point2D;
  endPoint: Point2D;
  thickness: number;
  color: string;
}

export default function Branch({ startPoint, endPoint, thickness, color }: BranchProps) {
  const pathData = generateLinePath(startPoint, endPoint);

  return (
    <Path
      d={pathData}
      stroke={color}
      strokeWidth={thickness}
      strokeLinecap="round"
      fill="none"
      opacity={0.7}
    />
  );
}
