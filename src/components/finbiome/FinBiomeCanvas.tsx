/**
 * FinBiomeCanvas Component
 *
 * Main composition for 2D FinBiome visualization.
 * Manages 4-layer system with pan/zoom interactions.
 */
import React, { useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, Animated, PanResponder, Dimensions, Platform } from 'react-native';
import { useDashboard } from '../../context/DashboardContext';
import { useFinBiome } from '../../context/FinBiomeContext';
import BackgroundLayer from './layers/BackgroundLayer';
import WaterfallLayer from './layers/WaterfallLayer';
import TreeLayer from './layers/TreeLayer';
import RiverLayer from './layers/RiverLayer';
import MiniMap from './ui/MiniMap';
import {
  build2DForestLayout,
  build2DTree,
  build2DRiverLayout,
  DEFAULT_TREE_CONFIG,
} from '../../lib/finbiome/dataTransforms2D';
import type { MiniMapData } from '../../lib/finbiome/types2D';

const TREE_SPACING = 400;

export default function FinBiomeCanvas() {
  const { accounts, categories, transactions } = useDashboard();
  const {
    panX,
    panY,
    selectedAccountId,
    setSelectedAccountId,
    onTrunkTap,
    onBranchTap,
    onLeafTap,
    onWaterfallTap,
    onRiverTap,
    scaleAnim,
    viewState,
    setPan,
  } = useFinBiome();

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const canvasHeight = screenHeight - 80; // Account for header

  // Transform data to 2D layouts
  const forestLayout = useMemo(
    () => build2DForestLayout(accounts, TREE_SPACING),
    [accounts]
  );

  const tree2DData = useMemo(() => {
    return forestLayout.map((layout) => {
      const account = accounts.find((a) => a.id === layout.accountId);
      if (!account) return null;

      const node = build2DTree(account, categories, transactions, DEFAULT_TREE_CONFIG);
      return { layout, node };
    }).filter(Boolean);
  }, [forestLayout, accounts, categories, transactions]);

  const riverFlows = useMemo(() => {
    const layouts = tree2DData.map((t) => t!.layout);
    const nodes = tree2DData.map((t) => t!.node);
    return build2DRiverLayout(layouts, nodes, canvasHeight);
  }, [tree2DData, canvasHeight]);

  // Calculate total canvas width and bounds (based on actual rendered trees)
  const totalWidth = useMemo(() => {
    if (tree2DData.length === 0) return screenWidth;
    // Last tree position + tree width gives us actual content width
    const lastTreeX = (tree2DData.length - 1) * TREE_SPACING;
    const treeWidth = 350; // From DEFAULT_TREE_CONFIG
    return lastTreeX + treeWidth;
  }, [tree2DData, screenWidth]);
  const maxScroll = -(totalWidth - screenWidth);

  // PanResponder - behavior depends on view mode
  const panResponderRef = useRef<any>(null);

  // Recreate panResponder when viewState changes
  if (!panResponderRef.current || panResponderRef.current.viewMode !== viewState.mode) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (viewState.mode === 'tree') {
          // Tree mode: allow any drag
          return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
        }
        // Biome mode: only horizontal drag
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 30;
      },

      onPanResponderGrant: (evt) => {
        panX.setOffset((panX as any)._value);
        if (viewState.mode === 'tree') {
          panY.setOffset((panY as any)._value);
        }
        // Prevent default scroll behavior on web
        if (Platform.OS === 'web') {
          evt.nativeEvent.preventDefault?.();
        }
      },

      onPanResponderMove: (evt, gestureState) => {
        if (viewState.mode === 'tree') {
          // Tree mode: free drag X and Y
          panX.setValue(gestureState.dx);
          panY.setValue(gestureState.dy);
        } else {
          // Biome mode: only X
          panX.setValue(gestureState.dx);
        }
      },

      onPanResponderRelease: (_evt, gestureState) => {
        panX.flattenOffset();
        if (viewState.mode === 'tree') {
          panY.flattenOffset();
        }

        // Apply bounds only in biome mode
        if (viewState.mode === 'biome') {
          const currentValue = (panX as any)._value;
          if (currentValue > 0) {
            Animated.spring(panX, {
              toValue: 0,
              useNativeDriver: true,
              overshootClamping: true,
              restDisplacementThreshold: 0.1,
              restSpeedThreshold: 0.1,
            }).start();
          } else if (currentValue < maxScroll && totalWidth > screenWidth) {
            Animated.spring(panX, {
              toValue: maxScroll,
              useNativeDriver: true,
              overshootClamping: true,
              restDisplacementThreshold: 0.1,
              restSpeedThreshold: 0.1,
            }).start();
          }
        }
        // In tree mode, no bounds - allow free exploration
      },
    });
    panResponderRef.current.viewMode = viewState.mode;
  }

  const panResponder = panResponderRef.current;

  // Tree tap handler (for trunk taps in biome mode)
  const handleTreeTap = useCallback(
    (accountId: string) => {
      const index = accounts.findIndex((a) => a.id === accountId);
      if (index !== -1) {
        setSelectedAccountId(accountId);
        onTrunkTap(accountId, index, screenWidth);
      }
    },
    [accounts, setSelectedAccountId, onTrunkTap, screenWidth]
  );

  // Mini-map data
  const miniMapData: MiniMapData = useMemo(
    () => ({
      totalWidth,
      viewportWidth: screenWidth,
      trees: tree2DData.map((t) => {
        const account = accounts.find((a) => a.id === t!.layout.accountId);
        return {
          accountId: t!.layout.accountId,
          accountName: account?.name || 'Account',
          x: t!.layout.position.x,
          width: t!.layout.width,
        };
      }),
      currentOffset: (panX as any)._value || 0,
    }),
    [totalWidth, screenWidth, tree2DData, accounts, panX]
  );

  // Combined tree data for rendering
  const treesWithRivers = useMemo(
    () =>
      tree2DData.map((t, i) => ({
        layout: t!.layout,
        node: t!.node,
        riverFlow: riverFlows[i],
      })),
    [tree2DData, riverFlows]
  );

  // Auto-select first account if none selected
  if (!selectedAccountId && tree2DData.length > 0) {
    const firstTreeAccountId = tree2DData[0]!.layout.accountId;
    setSelectedAccountId(firstTreeAccountId);
  }

  return (
    <View
      style={styles.container}
      onTouchStart={(e) => {
        // Prevent default scroll on web
        if (Platform.OS === 'web') {
          e.preventDefault();
        }
      }}
    >
      {/* Layer 1: Background (zIndex: 1) */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 1 }]} pointerEvents="none">
        <BackgroundLayer />
      </View>

      {/* Layer 2: Waterfall (zIndex: 2) - fixed to viewport, no transform */}
      <View
        style={[
          styles.waterfallContainer,
          {
            zIndex: 2,
          },
        ]}
      >
        <WaterfallLayer
          canvasWidth={screenWidth}
          canvasHeight={canvasHeight}
          onTap={onWaterfallTap}
        />
      </View>

      {/* Layer 3: Trees (zIndex: 3) - pans X+Y */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            zIndex: 3,
            transform: [
              { translateX: panX },
              { translateY: panY },
              { scale: scaleAnim },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TreeLayer
          trees={treesWithRivers}
          selectedAccountId={selectedAccountId}
          canvasWidth={totalWidth}
          canvasHeight={canvasHeight}
          onTapTree={handleTreeTap}
          onTapBranch={onBranchTap}
          onTapLeaf={onLeafTap}
          viewMode={viewState.mode}
        />
      </Animated.View>

      {/* Layer 4: River (zIndex: 4) - pans with trees, hidden in tree mode */}
      {viewState.mode === 'biome' && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 4,
              transform: [
                { translateX: panX },
                { translateY: panY },
                { scale: scaleAnim },
              ],
            },
          ]}
          pointerEvents="box-none"
        >
          <RiverLayer
            flows={riverFlows}
            treeLayouts={forestLayout}
            canvasWidth={totalWidth}
            canvasHeight={canvasHeight}
            onTap={onRiverTap}
          />
        </Animated.View>
      )}

      {/* UI Overlay: MiniMap (zIndex: 100) */}
      <View
        style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
        pointerEvents="box-none"
      >
        <MiniMap data={miniMapData} viewportWidth={screenWidth} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#07090F',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      // @ts-ignore - web-only CSS
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    } : {}),
  },
  waterfallContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
});
