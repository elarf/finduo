/**
 * MiniMap Component
 *
 * Navigation mini-map for quick tree selection.
 * Shows thumbnail overview with viewport indicator and zoom controls.
 */
import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, PanResponder, Animated } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { MiniMapData } from '../../../lib/finbiome/types2D';
import { useFinBiome } from '../../../context/FinBiomeContext';
import Icon from '../../Icon';

interface MiniMapProps {
  data: MiniMapData;
  viewportWidth: number;
}

export default function MiniMap({ data, viewportWidth }: MiniMapProps) {
  const { zoomToTree, zoomToBiome, panX, viewState, miniMapTitle } = useFinBiome();
  const [currentOffset, setCurrentOffset] = useState(0);

  const { totalWidth, trees } = data;

  const miniMapContainerWidth = viewportWidth * 0.3; // 30% of screen width
  const miniMapHeight = 80;

  // Scale to fill entire minimap width
  const miniMapWidth = miniMapContainerWidth;
  const scale = miniMapWidth / totalWidth;

  // Sync with panX animation
  useEffect(() => {
    const listenerId = panX.addListener(({ value }) => {
      setCurrentOffset(value);
    });

    return () => {
      panX.removeListener(listenerId);
    };
  }, [panX]);

  // PanResponder for dragging viewport indicator
  const viewportPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        // Store initial offset
        panX.stopAnimation();
      },

      onPanResponderMove: (evt, gestureState) => {
        // Calculate new offset based on gesture
        const miniMapDx = gestureState.dx;
        const fullCanvasDx = miniMapDx / scale;

        // Current offset from gesture start
        const initialOffset = currentOffset;
        let newOffset = initialOffset + fullCanvasDx;

        // Apply bounds
        const maxScroll = -(totalWidth - viewportWidth);
        newOffset = Math.max(maxScroll, Math.min(0, newOffset));

        // Update panX directly (no animation)
        panX.setValue(newOffset);
      },

      onPanResponderRelease: () => {
        // No spring back needed
      },
    })
  ).current;

  // Viewport indicator position and width
  const viewportX = Math.abs(currentOffset) * scale;
  const viewportIndicatorWidth = Math.min(viewportWidth * scale, miniMapWidth);

  // Calculate which tree is currently centered in viewport
  const viewportCenterWorldX = -currentOffset + viewportWidth / 2;
  const treeSpacing = 400; // Must match TREE_SPACING from FinBiomeCanvas
  const centeredTreeIndex = Math.max(0, Math.min(
    Math.floor(viewportCenterWorldX / treeSpacing),
    trees.length - 1
  ));
  const centeredTree = trees[centeredTreeIndex];
  const accountDisplayName = centeredTree?.accountName || 'Unknown';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{miniMapTitle.text}</Text>
        {viewState.mode === 'tree' && (
          <TouchableOpacity style={styles.zoomOutButton} onPress={zoomToBiome}>
            <Icon name="ZoomOut" size={16} color="#00F5D4" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.svgContainer}>
        <Svg width={miniMapWidth} height={miniMapHeight} style={styles.svg}>
          {/* Trees as small rectangles */}
          {trees.map((tree, index) => (
            <Rect
              key={tree.accountId}
              x={tree.x * scale}
              y={20}
              width={Math.max(tree.width * scale, 10)} // Minimum visible width
              height={40}
              fill="#00F5D4"
              opacity={0.4}
              rx={2}
              onPress={() => {
                // Instantly zoom to this tree in FinTree view
                zoomToTree(tree.accountId, index, viewportWidth);
              }}
            />
          ))}

          {/* Viewport indicator */}
          <Rect
            x={viewportX}
            y={0}
            width={viewportIndicatorWidth}
            height={miniMapHeight}
            fill="rgba(83, 227, 166, 0.1)"
            stroke="#53E3A6"
            strokeWidth={2}
            opacity={0.8}
            rx={4}
          />
        </Svg>

        {/* Draggable overlay for viewport indicator */}
        <View
          style={[
            styles.viewportOverlay,
            {
              left: viewportX,
              width: viewportIndicatorWidth,
            },
          ]}
          {...viewportPanResponder.panHandlers}
        />
      </View>

      {/* Current account name */}
      <Text style={styles.info}>{accountDisplayName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10, // 10px from top of canvas (canvas is already below header)
    left: 20, // Left side instead of right
    backgroundColor: 'rgba(10, 20, 40, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 212, 0.3)',
    padding: 12,
    width: '30%', // 30% of screen width
    maxWidth: 400,
    minWidth: 200,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#00F5D4',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: 'DM Sans',
  },
  zoomOutButton: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 245, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  svg: {
    // SVG positioned here
  },
  viewportOverlay: {
    position: 'absolute',
    top: 0,
    height: 80,
    backgroundColor: 'transparent',
    cursor: 'grab',
  },
  info: {
    color: '#8FA8C9',
    fontSize: 10,
    fontFamily: 'DM Sans',
  },
});
