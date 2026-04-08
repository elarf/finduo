/**
 * RiverLayer Component
 *
 * Renders vertical river flows from tree roots (Layer 4, zIndex: 4).
 * Pans horizontally with trees.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G } from 'react-native-svg';
import RiverFlow from '../svg/RiverFlow';
import type { River2DFlow } from '../../../lib/finbiome/types2D';

interface RiverLayerProps {
  flows: River2DFlow[];
  treeLayouts: Array<{ accountId: string; position: { x: number; y: number } }>;
  canvasWidth: number;
  canvasHeight: number;
  onTap: () => void;
}

export default function RiverLayer({
  flows,
  treeLayouts,
  canvasWidth,
  canvasHeight,
  onTap,
}: RiverLayerProps) {
  return (
    <View style={styles.container} onTouchEnd={onTap}>
      <Svg width={canvasWidth} height={canvasHeight} style={styles.svg}>
        {flows.map((flow) => {
          // Find tree position for offset
          const treeLayout = treeLayouts.find(t => t.accountId === flow.treeAccountId);
          if (!treeLayout) return null;

          return (
            <G key={flow.treeAccountId} x={treeLayout.position.x}>
              {/* Main stream from merge point to bottom */}
              <RiverFlow
                streamPath={flow.streamPath}
                width={flow.width}
                color={flow.color}
              />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  svg: {
    ...StyleSheet.absoluteFillObject,
  },
});
