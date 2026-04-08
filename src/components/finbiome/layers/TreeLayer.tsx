/**
 * TreeLayer Component
 *
 * Renders all financial trees side-by-side (Layer 3, zIndex: 3).
 * Supports tap detection for trunk, branches, and leaves based on view mode.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Rect } from 'react-native-svg';
import TreeTrunk from '../svg/TreeTrunk';
import Branch from '../svg/Branch';
import Leaf from '../svg/Leaf';
import Root from '../svg/Root';
import type { Tree2DLayout, Tree2DNode, River2DFlow, ViewMode } from '../../../lib/finbiome/types2D';

interface TreeLayerProps {
  trees: Array<{ layout: Tree2DLayout; node: Tree2DNode; riverFlow: River2DFlow }>;
  selectedAccountId: string | null;
  canvasWidth: number;
  canvasHeight: number;
  onTapTree: (accountId: string) => void;
  onTapBranch: (categoryName: string) => void;
  onTapLeaf: (transactionDescription: string) => void;
  viewMode: ViewMode;
}

export default function TreeLayer({
  trees,
  selectedAccountId,
  canvasWidth,
  canvasHeight,
  onTapTree,
  onTapBranch,
  onTapLeaf,
  viewMode,
}: TreeLayerProps) {
  return (
    <View style={styles.container}>
      <Svg width={canvasWidth} height={canvasHeight} style={styles.svg}>
        {trees.map(({ layout, node, riverFlow }) => {
          const isSelected = layout.accountId === selectedAccountId;
          const opacity = isSelected ? 1 : 0.3;

          return (
            <G
              key={layout.accountId}
              x={layout.position.x}
              y={layout.position.y}
              opacity={opacity}
            >
              {/* Selection highlight */}
              {isSelected && (
                <Rect
                  x={-10}
                  y={-10}
                  width={layout.width + 20}
                  height={layout.height + 20}
                  fill="none"
                  stroke="#00F5D4"
                  strokeWidth={2}
                  opacity={0.5}
                  rx={8}
                />
              )}

              {/* Roots (drawn first, behind tree) */}
              {riverFlow.rootPaths.map((rootPath, i) => (
                <Root key={`root-${i}`} path={rootPath} />
              ))}

              {/* Trunk - tappable in biome mode only */}
              <G
                onPress={(e) => {
                  if (viewMode === 'biome') {
                    e.stopPropagation();
                    onTapTree(layout.accountId);
                  }
                }}
              >
                <TreeTrunk
                  x={node.position.x}
                  y={node.position.y}
                  width={30}
                  height={100}
                  color={node.color}
                />
              </G>

              {/* Branches and Leaves */}
              {node.children.map((branchNode) => {
                const categoryData = branchNode.data as any;
                const categoryName = categoryData?.name || 'Category';

                return (
                  <G key={branchNode.id}>
                    {/* Branch connection from trunk to category */}
                    <Branch
                      startPoint={node.position}
                      endPoint={branchNode.position}
                      thickness={Math.max(2, Math.min(8, Math.log10(branchNode.value + 1) * 2))}
                      color={branchNode.color}
                    />

                    {/* Category node (small rect) - tappable in tree mode */}
                    <Rect
                      x={branchNode.position.x - 8}
                      y={branchNode.position.y - 8}
                      width={16}
                      height={16}
                      fill={branchNode.color}
                      rx={3}
                      opacity={0.9}
                      onPress={(e) => {
                        if (viewMode === 'tree') {
                          e.stopPropagation();
                          onTapBranch(categoryName);
                        }
                      }}
                    />

                    {/* Transaction leaves */}
                    {branchNode.children.map((leafNode) => {
                      const txData = leafNode.data as any;
                      const txDescription = txData?.description || 'Transaction';

                      return (
                        <G key={leafNode.id}>
                          {/* Connection from category to leaf */}
                          <Branch
                            startPoint={branchNode.position}
                            endPoint={leafNode.position}
                            thickness={1.5}
                            color={branchNode.color}
                          />

                          {/* Leaf - tappable in tree mode */}
                          <G
                            onPress={(e) => {
                              if (viewMode === 'tree') {
                                e.stopPropagation();
                                onTapLeaf(txDescription);
                              }
                            }}
                          >
                            <Leaf
                              center={leafNode.position}
                              radius={6}
                              color={leafNode.color}
                            />
                          </G>
                        </G>
                      );
                    })}
                  </G>
                );
              })}
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
