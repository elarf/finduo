/**
 * Root SVG Component
 *
 * Bezier curve representing root path from branch to river.
 */
import React from 'react';
import { Path } from 'react-native-svg';
import type { RootPath } from '../../../lib/finbiome/types2D';
import { generateRootPath } from '../../../lib/finbiome/svgHelpers';

interface RootProps {
  path: RootPath;
}

export default function Root({ path }: RootProps) {
  const pathData = generateRootPath(path.startPoint, path.endPoint);

  return (
    <Path
      d={pathData}
      stroke={path.color}
      strokeWidth={path.width}
      fill="none"
      opacity={0.5}
      strokeLinecap="round"
    />
  );
}
