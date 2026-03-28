/**
 * Pure settlement algorithm for shared expenses.
 *
 * Calculates who owes whom with equal splitting and minimized transactions.
 */

export type Transaction = {
  paid_by: string;
  amount: number;
  split_among?: string[]; // if omitted, splits among all participants
};

export type SettlementTransfer = {
  from: string;
  to: string;
  amount: number;
};

export type SettlementResult = {
  balances: Record<string, number>;
  transfers: SettlementTransfer[];
};

/**
 * Calculate settlement for a pool of expenses.
 *
 * @param participants - List of participant IDs
 * @param transactions - List of expenses (who paid, amount, optional split list)
 * @returns Settlement result with balances and minimized transfers
 *
 * @example
 * const result = calculateSettlement(
 *   ['alice', 'bob', 'charlie'],
 *   [
 *     { paid_by: 'alice', amount: 90 },
 *     { paid_by: 'bob', amount: 30, split_among: ['bob', 'charlie'] },
 *   ]
 * );
 * // result.balances: { alice: 60, bob: -15, charlie: -45 }
 * // result.transfers: [{ from: 'charlie', to: 'alice', amount: 45 }, { from: 'bob', to: 'alice', amount: 15 }]
 */
export function calculateSettlement(
  participants: string[],
  transactions: Transaction[]
): SettlementResult {
  // Step 1: Initialize balances
  const balance: Record<string, number> = {};
  for (const uid of participants) {
    balance[uid] = 0;
  }

  // Step 2: Calculate net balance for each participant
  for (const tx of transactions) {
    const splitMembers = tx.split_among ?? participants;
    const share = tx.amount / splitMembers.length;

    // Person who paid gets credited the full amount
    balance[tx.paid_by] = (balance[tx.paid_by] ?? 0) + tx.amount;

    // Everyone in split_among gets debited their share
    for (const uid of splitMembers) {
      balance[uid] = (balance[uid] ?? 0) - share;
    }
  }

  // Step 3: Round balances to 2 decimal places to avoid floating point errors
  for (const uid of Object.keys(balance)) {
    balance[uid] = Math.round(balance[uid] * 100) / 100;
  }

  // Step 4: Minimize transfers using greedy algorithm
  // Separate into creditors (owed money) and debtors (owe money)
  const creditors: { userId: string; amount: number }[] = [];
  const debtors: { userId: string; amount: number }[] = [];

  for (const [uid, bal] of Object.entries(balance)) {
    if (bal > 0.005) {
      creditors.push({ userId: uid, amount: bal });
    } else if (bal < -0.005) {
      debtors.push({ userId: uid, amount: Math.abs(bal) });
    }
  }

  // Sort both lists in descending order (greedy: match largest amounts first)
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // Step 5: Generate minimized transfers
  const transfers: SettlementTransfer[] = [];
  let ci = 0; // creditor index
  let di = 0; // debtor index

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];

    // Transfer the minimum of what's owed and what's due
    const transferAmount = Math.round(Math.min(creditor.amount, debtor.amount) * 100) / 100;

    if (transferAmount > 0) {
      transfers.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: transferAmount,
      });
    }

    // Update remaining amounts
    creditor.amount = Math.round((creditor.amount - transferAmount) * 100) / 100;
    debtor.amount = Math.round((debtor.amount - transferAmount) * 100) / 100;

    // Move to next creditor/debtor if current one is settled
    if (creditor.amount < 0.005) ci++;
    if (debtor.amount < 0.005) di++;
  }

  return {
    balances: balance,
    transfers,
  };
}
