/**
 * WaterfallLayer Component
 *
 * Waterfall visualization (Layer 2, zIndex: 2).
 * Fixed position at top-right, no panning or transforms.
 */
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Svg from 'react-native-svg';
import WaterfallPath from '../svg/WaterfallPath';

interface WaterfallLayerProps {
  canvasWidth: number;
  canvasHeight: number;
  onTap: () => void;
}

export default function WaterfallLayer({
  canvasWidth,
  canvasHeight,
  onTap,
}: WaterfallLayerProps) {
  // Waterfall dimensions (must match WaterfallPath)
  const cliffWidth = 80;
  const waterfallWidth = 40;
  const totalWidth = cliffWidth * 2 + waterfallWidth;
  const cliffHeight = 300;
  const rightPadding = 50;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Non-interactive SVG background */}
      <Svg width={canvasWidth} height={canvasHeight} style={styles.svg} pointerEvents="none">
        <WaterfallPath canvasWidth={canvasWidth} canvasHeight={canvasHeight} />
      </Svg>

      {/* Tappable hit area only over waterfall */}
      <TouchableOpacity
        style={[
          styles.tapArea,
          {
            right: rightPadding,
            width: totalWidth,
            height: cliffHeight + 10, // Include water source
          },
        ]}
        onPress={onTap}
        activeOpacity={0.8}
      />
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
  tapArea: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'transparent', // Transparent but tappable
  },
});
