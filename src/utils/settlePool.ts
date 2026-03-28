/**
 * Pure settlement calculator for pools.
 *
 * Given a list of participants and transactions, computes the minimum set of
 * transfers needed to settle all debts (equal split).
 */

export type SettlementTransaction = {
  pool_id: string;
  paid_by: string;
  amount: number;
};

export type Debt = {
  from: string; // debtor
  to: string;   // creditor
  amount: number;
};

/**
 * Calculate the minimum debts to settle a pool.
 *
 * Algorithm:
 *   1. Compute each person's net balance (paid − fair share).
 *   2. Separate into creditors (positive balance) and debtors (negative balance).
 *   3. Greedily match the largest debtor with the largest creditor, settling the
 *      smaller of the two amounts each step, until all balances are zero.
 *
 * This greedy approach produces at most (n − 1) transfers, which is optimal for
 * the equal-split case.
 */
export function settlePool(
  participants: string[],
  transactions: SettlementTransaction[],
): Debt[] {
  if (participants.length === 0) return [];

  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const share = total / participants.length;

  // Net balance per participant: positive = overpaid (is owed), negative = underpaid (owes)
  const balances = new Map<string, number>();
  for (const p of participants) {
    balances.set(p, -share);
  }
  for (const tx of transactions) {
    balances.set(tx.paid_by, (balances.get(tx.paid_by) ?? -share) + tx.amount);
  }

  // Split into creditors and debtors
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [id, balance] of balances) {
    // Round to cents to avoid floating-point dust
    const rounded = Math.round(balance * 100) / 100;
    if (rounded > 0) creditors.push({ id, amount: rounded });
    else if (rounded < 0) debtors.push({ id, amount: -rounded });
  }

  // Sort descending so we always match the two largest first
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const debts: Debt[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const settle = Math.min(creditors[ci].amount, debtors[di].amount);
    if (settle > 0) {
      debts.push({
        from: debtors[di].id,
        to: creditors[ci].id,
        amount: Math.round(settle * 100) / 100,
      });
    }
    creditors[ci].amount -= settle;
    debtors[di].amount -= settle;

    if (creditors[ci].amount < 0.005) ci++;
    if (debtors[di].amount < 0.005) di++;
  }

  return debts;
}
