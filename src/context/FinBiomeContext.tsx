/**
 * FinBiome Context
 *
 * State management for 2D FinBiome visualization:
 * - 2 view modes: 'biome' (overview) and 'tree' (zoomed detail)
 * - Pan animations (X for biome, X+Y for tree)
 * - Tree selection and minimap title state
 */
import React, { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react';
import { Animated } from 'react-native';
import type { ViewMode, ViewState, MiniMapTitle } from '../lib/finbiome/types2D';

interface FinBiomeContextValue {
  // View state
  viewState: ViewState;
  selectedAccountId: string | null;
  miniMapTitle: MiniMapTitle;

  // Animated values
  panX: Animated.Value;
  panY: Animated.Value;
  scaleAnim: Animated.Value;

  // Actions
  setSelectedAccountId: (accountId: string | null) => void;
  setMiniMapTitle: (title: MiniMapTitle) => void;
  zoomToTree: (accountId: string, treeIndex: number, viewportWidth?: number) => void;
  zoomToBiome: () => void;
  setPan: (x: number, y: number) => void;
  onTrunkTap: (accountId: string, treeIndex: number, viewportWidth?: number) => void;
  onBranchTap: (categoryName: string) => void;
  onLeafTap: (transactionDescription: string) => void;
  onWaterfallTap: () => void;
  onRiverTap: () => void;
}

const FinBiomeContext = createContext<FinBiomeContextValue | null>(null);

interface FinBiomeProviderProps {
  children: ReactNode;
  initialSelectedAccountId?: string | null;
}

export function FinBiomeProvider({ children, initialSelectedAccountId = null }: FinBiomeProviderProps) {
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current; // Start at 0.7 for biome view

  const [viewState, setViewState] = useState<ViewState>({
    mode: 'biome',
    selectedAccountId: initialSelectedAccountId,
    focusPoint: null,
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    initialSelectedAccountId
  );

  const [miniMapTitle, setMiniMapTitle] = useState<MiniMapTitle>({
    text: 'FinBiome',
  });

  // Zoom to specific tree (FinTree mode)
  const zoomToTree = useCallback(
    (accountId: string, treeIndex: number, viewportWidth?: number) => {
      setSelectedAccountId(accountId);
      setMiniMapTitle({ text: 'FinTree' });

      const treeSpacing = 400;
      const treeWidth = 350;
      const trunkRelativeX = treeWidth / 2; // Trunk at center of tree canvas

      // Calculate trunk world position
      const treeWorldX = treeIndex * treeSpacing;
      const trunkWorldX = treeWorldX + trunkRelativeX;

      // Center trunk in viewport
      const vpWidth = viewportWidth || 1000; // Default fallback
      const targetX = -(trunkWorldX - vpWidth / 2);

      const targetY = -150; // Focus on branches area (above trunk)

      setViewState({
        mode: 'tree',
        selectedAccountId: accountId,
        focusPoint: { x: targetX, y: targetY },
      });

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 2, // 2x zoom for tree detail
          useNativeDriver: true,
          overshootClamping: true,
          restDisplacementThreshold: 0.1,
          restSpeedThreshold: 0.1,
        }),
        Animated.spring(panX, {
          toValue: targetX,
          useNativeDriver: true,
          overshootClamping: true,
          restDisplacementThreshold: 0.1,
          restSpeedThreshold: 0.1,
        }),
        Animated.spring(panY, {
          toValue: targetY,
          useNativeDriver: true,
          overshootClamping: true,
          restDisplacementThreshold: 0.1,
          restSpeedThreshold: 0.1,
        }),
      ]).start();
    },
    [panX, panY, scaleAnim]
  );

  // Zoom back to FinBiome (overview)
  const zoomToBiome = useCallback(() => {
    setMiniMapTitle({ text: 'FinBiome' });

    setViewState({
      mode: 'biome',
      selectedAccountId: null,
      focusPoint: null,
    });

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.7, // 0.7x scale to show at least 3 trees
        useNativeDriver: true,
        overshootClamping: true,
        restDisplacementThreshold: 0.1,
        restSpeedThreshold: 0.1,
      }),
      Animated.spring(panY, {
        toValue: 0, // Reset Y pan
        useNativeDriver: true,
        overshootClamping: true,
        restDisplacementThreshold: 0.1,
        restSpeedThreshold: 0.1,
      }),
      // Keep panX as-is to maintain horizontal scroll position
    ]).start();
  }, [panY, scaleAnim]);

  // Set pan directly (for drag gestures)
  const setPan = useCallback((x: number, y: number) => {
    panX.setValue(x);
    panY.setValue(y);
  }, [panX, panY]);

  // Tap handlers
  const onTrunkTap = useCallback(
    (accountId: string, treeIndex: number, viewportWidth?: number) => {
      // Tap trunk in biome mode → zoom to tree
      if (viewState.mode === 'biome') {
        zoomToTree(accountId, treeIndex, viewportWidth);
      }
    },
    [viewState.mode, zoomToTree]
  );

  const onBranchTap = useCallback((categoryName: string) => {
    // Only works in tree mode
    setMiniMapTitle({ text: categoryName });
  }, []);

  const onLeafTap = useCallback((transactionDescription: string) => {
    // Only works in tree mode
    setMiniMapTitle({ text: transactionDescription });
  }, []);

  const onWaterfallTap = useCallback(() => {
    setMiniMapTitle({ text: 'FinFlow' });
  }, []);

  const onRiverTap = useCallback(() => {
    setMiniMapTitle({ text: 'FinRiver' });
  }, []);

  const value: FinBiomeContextValue = {
    viewState,
    selectedAccountId,
    miniMapTitle,
    panX,
    panY,
    scaleAnim,
    setSelectedAccountId,
    setMiniMapTitle,
    zoomToTree,
    zoomToBiome,
    setPan,
    onTrunkTap,
    onBranchTap,
    onLeafTap,
    onWaterfallTap,
    onRiverTap,
  };

  return <FinBiomeContext.Provider value={value}>{children}</FinBiomeContext.Provider>;
}

export function useFinBiome(): FinBiomeContextValue {
  const context = useContext(FinBiomeContext);
  if (!context) {
    throw new Error('useFinBiome must be used within FinBiomeProvider');
  }
  return context;
}
