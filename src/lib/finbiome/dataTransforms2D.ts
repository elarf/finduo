/**
 * Data transformation functions for 2D FinBiome
 *
 * Converts dashboard data (accounts, categories, transactions) into
 * 2D-ready structures for layered SVG visualization.
 */

import type {
  AppAccount,
  AppCategory,
  AppTransaction,
} from '../../types/dashboard';
import type {
  Point2D,
  Tree2DLayout,
  Tree2DLayoutConfig,
  Tree2DNode,
  River2DFlow,
  RootPath,
  Waterfall2DLayout,
} from './types2D';
import type { TreeNode, FlowStep } from './types';
import { buildTreeHierarchy } from './dataTransforms';

/**
 * Forest Layout: Position accounts horizontally in 2D space
 *
 * Arranges accounts side-by-side for horizontal scrolling.
 */
export function build2DForestLayout(
  accounts: AppAccount[],
  treeSpacing: number = 400 // Horizontal spacing between trees
): Tree2DLayout[] {
  const treeWidth = 350;
  const treeHeight = 800;

  return accounts.map((account, index) => ({
    accountId: account.id,
    position: {
      x: index * treeSpacing,
      y: 0, // All trees at same vertical baseline
    },
    width: treeWidth,
    height: treeHeight,
  }));
}

/**
 * Convert 3D tree hierarchy to 2D flat layout
 *
 * Vertical orientation:
 * - Trunk at 30% from bottom
 * - Expense branches extend upward
 * - Income roots extend downward
 * - Leaves around branches/roots
 */
export function convert3DTreeTo2D(
  tree3D: TreeNode,
  config: Tree2DLayoutConfig
): Tree2DNode {
  const { width, height, trunkWidth, trunkHeight, branchRadius, leafRadius } = config;

  // Trunk at 30% from bottom (70% from top)
  const trunkX = width / 2;
  const trunkY = height * 0.7 - trunkHeight; // 70% down = 30% from bottom

  // Root node (trunk)
  const root2D: Tree2DNode = {
    ...tree3D,
    position: { x: trunkX, y: trunkY },
    children: [],
  };

  // Separate income and expense categories
  const incomeCategories: TreeNode[] = [];
  const expenseCategories: TreeNode[] = [];

  tree3D.children.forEach((categoryNode) => {
    const categoryData = categoryNode.data as any;
    if (categoryData.type === 'income') {
      incomeCategories.push(categoryNode);
    } else {
      expenseCategories.push(categoryNode);
    }
  });

  // Process expense categories as upward branches
  expenseCategories.forEach((categoryNode, index) => {
    const totalBranches = expenseCategories.length;

    // Distribute branches in upper half-circle (upward)
    const angle = Math.PI + (index / Math.max(totalBranches - 1, 1)) * Math.PI;

    const branchX = trunkX + Math.cos(angle) * branchRadius;
    const branchY = trunkY + Math.sin(angle) * branchRadius;

    const branch2D: Tree2DNode = {
      ...categoryNode,
      position: { x: branchX, y: branchY },
      children: [],
    };

    // Convert transaction leaves
    categoryNode.children.forEach((leafNode, leafIndex) => {
      const totalLeaves = categoryNode.children.length;

      // Distribute leaves around branch
      const leafAngle = (leafIndex / Math.max(totalLeaves, 1)) * Math.PI * 2;
      const leafX = branchX + Math.cos(leafAngle) * leafRadius;
      const leafY = branchY + Math.sin(leafAngle) * leafRadius;

      const leaf2D: Tree2DNode = {
        ...leafNode,
        position: { x: leafX, y: leafY },
        children: [],
      };

      branch2D.children.push(leaf2D);
    });

    root2D.children.push(branch2D);
  });

  // Process income categories as downward roots
  incomeCategories.forEach((categoryNode, index) => {
    const totalRoots = incomeCategories.length;

    // Narrower spread for roots (60 degrees instead of 180)
    const rootSpreadAngle = Math.PI / 3; // 60 degrees
    const centerAngle = Math.PI / 2; // Pointing straight down
    const angle = centerAngle - rootSpreadAngle / 2 + (index / Math.max(totalRoots - 1, 1)) * rootSpreadAngle;

    // Smaller radius for roots
    const rootRadius = branchRadius * 0.6;

    const rootX = trunkX + Math.cos(angle) * rootRadius;
    const rootY = trunkY + trunkHeight + Math.sin(angle) * rootRadius; // From BOTTOM of trunk

    const root2DNode: Tree2DNode = {
      ...categoryNode,
      position: { x: rootX, y: rootY },
      children: [],
    };

    // Convert transaction leaves (still around the root category)
    categoryNode.children.forEach((leafNode, leafIndex) => {
      const totalLeaves = categoryNode.children.length;

      // Distribute leaves around root
      const leafAngle = (leafIndex / Math.max(totalLeaves, 1)) * Math.PI * 2;
      const leafX = rootX + Math.cos(leafAngle) * leafRadius;
      const leafY = rootY + Math.sin(leafAngle) * leafRadius;

      const leaf2D: Tree2DNode = {
        ...leafNode,
        position: { x: leafX, y: leafY },
        children: [],
      };

      root2DNode.children.push(leaf2D);
    });

    root2D.children.push(root2DNode);
  });

  return root2D;
}

/**
 * Build complete 2D tree with hierarchy and layout
 */
export function build2DTree(
  account: AppAccount,
  categories: AppCategory[],
  transactions: AppTransaction[],
  config: Tree2DLayoutConfig
): Tree2DNode {
  // Reuse existing 3D hierarchy builder
  const tree3D = buildTreeHierarchy(account, categories, transactions);

  // Convert to 2D layout
  return convert3DTreeTo2D(tree3D, config);
}

/**
 * River Layout: Build vertical flows from income roots to bottom
 *
 * Income categories extend downward as roots that flow to the river.
 */
export function build2DRiverLayout(
  treeLayouts: Tree2DLayout[],
  tree2DNodes: Tree2DNode[],
  canvasHeight: number
): River2DFlow[] {
  const flows: River2DFlow[] = [];

  treeLayouts.forEach((layout, index) => {
    const treeNode = tree2DNodes[index];
    if (!treeNode) return;

    const trunkX = layout.width / 2; // Center of tree (tree-relative)
    const trunkY = layout.height * 0.7; // 30% from bottom
    const trunkHeight = 100; // From config

    // Create root paths only from income categories (downward roots)
    const rootPaths: RootPath[] = [];
    const mergePoint: Point2D = {
      x: trunkX,
      y: trunkY + trunkHeight + 100, // Below trunk bottom + extra space
    };

    // Filter for income categories only
    treeNode.children.forEach((categoryNode) => {
      const categoryData = categoryNode.data as any;

      // Only create root paths for income categories
      if (categoryData.type !== 'income') return;

      const rootX = categoryNode.position.x; // Tree-relative
      const rootY = categoryNode.position.y; // Tree-relative

      // Bezier curve from income root to merge point
      const startPoint: Point2D = { x: rootX, y: rootY + 10 };
      const controlPoints: Point2D[] = [
        { x: startPoint.x, y: startPoint.y + 30 },
        { x: mergePoint.x, y: mergePoint.y - 20 },
      ];

      rootPaths.push({
        startPoint,
        controlPoints,
        endPoint: mergePoint,
        color: categoryNode.color,
        width: Math.max(2, Math.min(8, Math.log10(categoryNode.value + 1) * 2)),
      });
    });

    // Stream path from merge point to bottom
    const streamPath: Point2D[] = [
      mergePoint,
      { x: mergePoint.x, y: mergePoint.y + 50 },
      { x: mergePoint.x, y: canvasHeight - 20 },
    ];

    // Stream width based on total tree value
    const totalValue = treeNode.value;
    const streamWidth = Math.max(10, Math.min(40, Math.log10(totalValue + 1) * 4));

    flows.push({
      treeAccountId: layout.accountId,
      rootPaths,
      mergePoint,
      streamPath,
      width: streamWidth,
      color: '#00F5D4',
    });
  });

  return flows;
}

/**
 * Waterfall Layout: Position waterfall in background (far left)
 */
export function build2DWaterfallLayout(
  flowSteps: FlowStep[],
  canvasHeight: number,
  viewportWidth: number = 1000 // Pass viewport width for positioning
): Waterfall2DLayout {
  const barWidth = 15; // Width per bar
  const barSpacing = 20;
  const totalWidth = flowSteps.length * (barWidth + barSpacing);

  return {
    position: {
      x: viewportWidth - totalWidth - 50, // Right edge of viewport, with 50px padding
      y: canvasHeight / 2 - 200, // Centered vertically
    },
    width: totalWidth,
    height: 400,
    flowSteps,
    barWidth,
    barSpacing,
  };
}

/**
 * Default tree layout configuration
 */
export const DEFAULT_TREE_CONFIG: Tree2DLayoutConfig = {
  width: 350,
  height: 800,
  trunkWidth: 30,
  trunkHeight: 100,
  branchRadius: 120,
  leafRadius: 40,
};
