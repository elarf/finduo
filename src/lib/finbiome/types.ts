/**
 * Type definitions for FinBiome 3D data structures
 */

import type { AppAccount, AppCategory, AppTransaction } from '../../types/dashboard';

// 3D position vector
export type Vector3 = [number, number, number];

// Forest Layout: Account positioning in 3D space
export interface ForestLayout {
  accountId: string;
  position: Vector3;
}

// Tree Node: Hierarchical structure for FinTree
export interface TreeNode {
  id: string;
  type: 'account' | 'category' | 'transaction';
  name: string;
  value: number; // Amount (for sizing)
  position: Vector3;
  color: string;

  // Hierarchy
  children: TreeNode[];
  parent?: TreeNode;

  // Original data reference
  data: AppAccount | AppCategory | AppTransaction;
}

// Flow Step: Waterfall chart data point
export interface FlowStep {
  id: string;
  type: 'starting' | 'income' | 'expense' | 'transfer' | 'ending';
  period: string; // Date or period label (e.g., "2026-01", "Jan 2026")
  value: number; // Delta for this step
  cumulativeValue: number; // Running total
  position: Vector3; // Position in 3D space
  color: string; // Bar color

  // Drill-down data
  transactions: AppTransaction[];
}

// Flow: Sankey-style account → category flow
export interface Flow {
  id: string;

  // Source and target
  sourceId: string;
  sourceName: string;
  sourceType: 'account' | 'category';

  targetId: string;
  targetName: string;
  targetType: 'account' | 'category';

  // Flow properties
  volume: number; // Total amount flowing
  thickness: number; // Visual thickness (2-40px)
  color: string;

  // Transactions in this flow
  transactions: AppTransaction[];

  // Curve control points for Bezier ribbons
  controlPoints: Vector3[];
}

// Flow Node: Source/target nodes in FinRiver
export interface FlowNode {
  id: string;
  name: string;
  type: 'account' | 'category';
  position: Vector3;
  totalInflow: number;
  totalOutflow: number;
  color: string;
}

// Complete River data structure
export interface RiverData {
  nodes: FlowNode[];
  flows: Flow[];
}

// Camera state for spatial navigation
export type CameraState = 'ecosystem' | 'tree' | 'flow' | 'river';

// Camera target configuration
export interface CameraTarget {
  position: Vector3;
  lookAt: Vector3;
  fov?: number;
}
