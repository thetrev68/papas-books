import { Transaction } from '../types/database';
import { ReconciliationResult } from '../types/reconcile';

export function calculateReconciliation(
  previousBalance: number,
  transactions: Transaction[],
  targetBalance: number
): ReconciliationResult {
  let deposits = 0;
  let withdrawals = 0;

  for (const tx of transactions) {
    if (tx.amount >= 0) {
      deposits += tx.amount;
    } else {
      withdrawals += tx.amount;
    }
  }

  const calculatedEndingBalance = previousBalance + deposits + withdrawals;
  const difference = targetBalance - calculatedEndingBalance;

  return {
    openingBalance: previousBalance,
    totalDeposits: deposits,
    totalWithdrawals: withdrawals,
    calculatedEndingBalance,
    difference,
    isBalanced: difference === 0,
  };
}

export function sumTransactionAmountForReconcile(tx: Transaction): number {
  if (tx.is_split && tx.lines?.length) {
    return tx.lines.reduce((sum, line) => sum + line.amount, 0);
  }
  return tx.amount;
}
