/**
 * Type definitions for 2D FinBiome visualization
 *
 * Flat 2D layout with x,y coordinates instead of 3D Vector3.
 * Used for layered SVG rendering system.
 */

import type { TreeNode, FlowStep, RiverData } from './types';
import type { AppAccount, AppCategory, AppTransaction } from '../../types/dashboard';

// 2D position (replaces Vector3)
export type Point2D = { x: number; y: number };

// Forest layout in 2D (horizontal arrangement)
export interface Tree2DLayout {
  accountId: string;
  position: Point2D; // Top-left corner of tree canvas
  width: number;
  height: number;
}

// Tree configuration for layout calculations
export interface Tree2DLayoutConfig {
  width: number; // Tree canvas width
  height: number; // Tree canvas height
  trunkWidth: number; // Trunk width
  trunkHeight: number; // Trunk height
  branchRadius: number; // Radial distance for branches
  leafRadius: number; // Radial distance for leaves from branches
}

// Tree node with 2D positions
export interface Tree2DNode extends Omit<TreeNode, 'position' | 'children'> {
  position: Point2D;
  children: Tree2DNode[];
}

// River flow (vertical path from tree roots to bottom)
export interface River2DFlow {
  treeAccountId: string;
  rootPaths: RootPath[]; // Multiple roots from category branches
  mergePoint: Point2D; // Where roots merge into single stream
  streamPath: Point2D[]; // Bezier curve to bottom of canvas
  width: number; // Stream width (based on transaction volume)
  color: string;
}

// Root path (from branch to river merge point)
export interface RootPath {
  startPoint: Point2D; // From category branch base
  controlPoints: Point2D[]; // Bezier curve control points
  endPoint: Point2D; // At merge point
  color: string;
  width: number;
}

// Waterfall layout (static background position)
export interface Waterfall2DLayout {
  position: Point2D; // Fixed position in background
  width: number;
  height: number;
  flowSteps: FlowStep[]; // Reuse existing FlowStep type
  barWidth: number; // Width of each waterfall bar
  barSpacing: number; // Spacing between bars
}

// Zoom/View states (simplified to 2 states)
export type ViewMode = 'biome' | 'tree';

// Current view state
export interface ViewState {
  mode: ViewMode;
  selectedAccountId: string | null;
  focusPoint: Point2D | null; // Where we're zoomed into (branches area) in tree mode
}

// Minimap title state
export interface MiniMapTitle {
  text: string; // 'FinBiome', 'FinTree', 'FinRiver', 'FinFlow', or category/transaction name
  subtext?: string; // Optional additional info
}

// Mini-map data
export interface MiniMapData {
  totalWidth: number; // Full canvas width
  viewportWidth: number; // Visible viewport width
  trees: Array<{
    accountId: string;
    accountName: string;
    x: number; // Position in canvas
    width: number; // Tree width
  }>;
  currentOffset: number; // Current scroll position (negative)
}
