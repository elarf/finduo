/**
 * Data transformation functions for FinBiome
 *
 * Converts dashboard data (accounts, categories, transactions) into
 * 3D-ready structures for FinTree, FinFlow, and FinRiver visualizations.
 */

import type {
  AppAccount,
  AppCategory,
  AppTransaction,
  IntervalKey,
} from '../../types/dashboard';
import type {
  Vector3,
  ForestLayout,
  TreeNode,
  FlowStep,
  Flow,
  FlowNode,
  RiverData,
} from './types';

/**
 * Forest Layout: Position accounts in 3D space
 *
 * Arranges accounts in a grid pattern with slight randomness for organic feel.
 * Ensures adequate spacing between trees.
 */
export function buildForestLayout(
  accounts: AppAccount[],
  spacing: number = 30
): ForestLayout[] {
  const layout: ForestLayout[] = [];
  const count = accounts.length;

  if (count === 0) return layout;

  // Calculate grid dimensions (prefer wider than tall)
  const cols = Math.ceil(Math.sqrt(count * 1.5));
  const rows = Math.ceil(count / cols);

  accounts.forEach((account, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;

    // Center the grid
    const offsetX = -((cols - 1) * spacing) / 2;
    const offsetZ = -((rows - 1) * spacing) / 2;

    // Add slight randomness for organic feel
    const randomX = (Math.random() - 0.5) * 4;
    const randomZ = (Math.random() - 0.5) * 4;

    const position: Vector3 = [
      offsetX + col * spacing + randomX,
      0, // Base level
      offsetZ + row * spacing + randomZ,
    ];

    layout.push({
      accountId: account.id,
      position,
    });
  });

  return layout;
}

/**
 * Tree Hierarchy: Build hierarchical tree for a single account
 *
 * Structure: Account (root) → Categories (branches) → Transactions (leaves)
 * Uses simple force-directed positioning for now (can be enhanced with proper algorithm)
 */
export function buildTreeHierarchy(
  account: AppAccount,
  categories: AppCategory[],
  transactions: AppTransaction[]
): TreeNode {
  // Filter transactions for this account
  const accountTransactions = transactions.filter(
    (t) => t.account_id === account.id
  );

  // Get unique categories used in this account
  const usedCategoryIds = new Set(
    accountTransactions
      .map((t) => t.category_id)
      .filter((id): id is string => id !== null && id !== undefined)
  );

  const usedCategories = categories.filter((cat) =>
    usedCategoryIds.has(cat.id)
  );

  // Calculate account total value
  const accountValue = accountTransactions.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0
  );

  // Root node: Account
  const rootNode: TreeNode = {
    id: account.id,
    type: 'account',
    name: account.name,
    value: accountValue,
    position: [0, 0, 0], // Root at origin
    color: '#E8F4FF', // Root white glow
    children: [],
    data: account,
  };

  // Branch nodes: Categories
  const categoryNodes: TreeNode[] = usedCategories.map((category, index) => {
    const categoryTransactions = accountTransactions.filter(
      (t) => t.category_id === category.id
    );

    const categoryValue = categoryTransactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );

    // Position categories in a circle around the root, growing upward
    const angle = (index / usedCategories.length) * Math.PI * 2;
    const radius = 8;
    const height = 5;

    const categoryNode: TreeNode = {
      id: category.id,
      type: 'category',
      name: category.name,
      value: categoryValue,
      position: [Math.cos(angle) * radius, height, Math.sin(angle) * radius],
      color: category.color || '#56CFE1', // Teal default
      children: [],
      parent: rootNode,
      data: category,
    };

    // Leaf nodes: Transactions (only show top 5 per category to avoid clutter)
    const topTransactions = categoryTransactions
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 5);

    topTransactions.forEach((transaction, txIndex) => {
      // Position leaves around their category branch
      const leafAngle = (txIndex / topTransactions.length) * Math.PI * 2;
      const leafRadius = 3;
      const leafHeight = 3;

      const leafNode: TreeNode = {
        id: transaction.id,
        type: 'transaction',
        name: transaction.note || `${Math.abs(transaction.amount)}`,
        value: Math.abs(transaction.amount),
        position: [
          categoryNode.position[0] + Math.cos(leafAngle) * leafRadius,
          categoryNode.position[1] + leafHeight,
          categoryNode.position[2] + Math.sin(leafAngle) * leafRadius,
        ],
        color:
          transaction.type === 'income' ? '#A8FF3E' : '#9B5DE5', // Green income, purple expense
        children: [],
        parent: categoryNode,
        data: transaction,
      };

      categoryNode.children.push(leafNode);
    });

    return categoryNode;
  });

  rootNode.children = categoryNodes;

  return rootNode;
}

/**
 * Flow Data: Build waterfall chart data
 *
 * Aggregates transactions by time period, calculates cumulative balance,
 * separates income/expense/transfer.
 */
export function buildFlowData(
  transactions: AppTransaction[],
  accounts: AppAccount[],
  interval: IntervalKey,
  inInterval: (date: string) => boolean
): FlowStep[] {
  const steps: FlowStep[] = [];

  // Filter transactions in current interval
  const filteredTransactions = transactions.filter((t) => inInterval(t.date));

  if (filteredTransactions.length === 0) {
    return steps;
  }

  // Group by period (for now, treat as single period - can enhance for multi-period)
  const periodLabel = 'Current Period';

  // Calculate starting balance (sum of all transactions before this period)
  const allTransactionsBeforePeriod = transactions.filter(
    (t) => !inInterval(t.date) && t.date < filteredTransactions[0].date
  );
  const startingBalance = allTransactionsBeforePeriod.reduce((sum, t) => {
    return sum + (t.type === 'income' ? t.amount : -t.amount);
  }, 0);

  steps.push({
    id: 'start',
    type: 'starting',
    period: 'Start',
    value: 0,
    cumulativeValue: startingBalance,
    position: [0, 0, 0],
    color: 'rgba(200, 216, 255, 0.3)',
    transactions: [],
  });

  // Aggregate income and expense
  const incomeTransactions = filteredTransactions.filter(
    (t) => t.type === 'income'
  );
  const expenseTransactions = filteredTransactions.filter(
    (t) => t.type === 'expense'
  );

  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = expenseTransactions.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0
  );

  let currentCumulative = startingBalance;

  // Income step
  if (totalIncome > 0) {
    currentCumulative += totalIncome;
    steps.push({
      id: 'income',
      type: 'income',
      period: periodLabel,
      value: totalIncome,
      cumulativeValue: currentCumulative,
      position: [steps.length * 10, 0, 0],
      color: '#00F5D4', // Cyan for income
      transactions: incomeTransactions,
    });
  }

  // Expense step
  if (totalExpense > 0) {
    currentCumulative -= totalExpense;
    steps.push({
      id: 'expense',
      type: 'expense',
      period: periodLabel,
      value: -totalExpense,
      cumulativeValue: currentCumulative,
      position: [steps.length * 10, 0, 0],
      color: '#F72585', // Magenta for expense
      transactions: expenseTransactions,
    });
  }

  // Ending balance
  steps.push({
    id: 'end',
    type: 'ending',
    period: 'End',
    value: 0,
    cumulativeValue: currentCumulative,
    position: [steps.length * 10, 0, 0],
    color: 'rgba(200, 216, 255, 0.3)',
    transactions: [],
  });

  return steps;
}

/**
 * River Flows: Build Sankey flow data
 *
 * Create flows from accounts → categories based on transactions.
 * Each flow represents money moving from a source to a destination.
 */
export function buildRiverFlows(
  accounts: AppAccount[],
  categories: AppCategory[],
  transactions: AppTransaction[]
): RiverData {
  const nodes: FlowNode[] = [];
  const flows: Flow[] = [];

  // Group transactions by account → category
  const flowMap = new Map<string, AppTransaction[]>();

  transactions.forEach((transaction) => {
    if (!transaction.category_id) return;

    const key = `${transaction.account_id}->${transaction.category_id}`;
    if (!flowMap.has(key)) {
      flowMap.set(key, []);
    }
    flowMap.get(key)!.push(transaction);
  });

  // Create nodes for accounts (sources)
  const accountNodes: FlowNode[] = accounts.map((account, index) => {
    const accountTransactions = transactions.filter(
      (t) => t.account_id === account.id
    );
    const totalOutflow = accountTransactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );

    return {
      id: account.id,
      name: account.name,
      type: 'account',
      position: [0, index * 5, 0], // Stack vertically on left
      totalInflow: 0,
      totalOutflow,
      color: '#00F5D4',
    };
  });

  // Create nodes for categories (targets)
  const categoryNodes: FlowNode[] = categories.map((category, index) => {
    const categoryTransactions = transactions.filter(
      (t) => t.category_id === category.id
    );
    const totalInflow = categoryTransactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );

    return {
      id: category.id,
      name: category.name,
      type: 'category',
      position: [30, index * 5, 0], // Stack vertically on right
      totalInflow,
      totalOutflow: 0,
      color: category.color || '#56CFE1',
    };
  });

  nodes.push(...accountNodes, ...categoryNodes);

  // Create flows
  flowMap.forEach((txs, key) => {
    const [sourceId, targetId] = key.split('->');
    const sourceNode = nodes.find((n) => n.id === sourceId);
    const targetNode = nodes.find((n) => n.id === targetId);

    if (!sourceNode || !targetNode) return;

    const volume = txs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const thickness = Math.max(2, Math.min(40, volume / 100)); // Scale thickness

    // Simple Bezier curve: start → mid → end
    const midPoint: Vector3 = [
      (sourceNode.position[0] + targetNode.position[0]) / 2,
      (sourceNode.position[1] + targetNode.position[1]) / 2,
      0,
    ];

    flows.push({
      id: `${sourceId}-${targetId}`,
      sourceId,
      sourceName: sourceNode.name,
      sourceType: 'account',
      targetId,
      targetName: targetNode.name,
      targetType: 'category',
      volume,
      thickness,
      color: sourceNode.color,
      transactions: txs,
      controlPoints: [sourceNode.position, midPoint, targetNode.position],
    });
  });

  return { nodes, flows };
}
