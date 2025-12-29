import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Account } from '../../types/database';
import {
  fetchUnreconciledTransactions,
  finalizeReconciliationRPC,
} from '../../lib/supabase/reconcile';
import { calculateReconciliation, sumTransactionAmountForReconcile } from '../../lib/reconciler';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../GlobalToastProvider';

interface ReconcileWorkspaceProps {
  account: Account;
  statementDate: string;
  statementBalance: number; // cents
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ReconcileWorkspace({
  account,
  statementDate,
  statementBalance,
  onSuccess,
  onCancel,
}: ReconcileWorkspaceProps) {
  const { activeBookset } = useAuth();
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // Fetch candidate transactions
  const {
    data: candidates = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['reconcile-candidates', account.id, statementDate],
    queryFn: () => fetchUnreconciledTransactions(account.id, statementDate),
    enabled: !!account.id,
  });

  // Calculate reconciliation state
  const reconciliationState = useMemo(() => {
    // If no last_reconciled_balance (first time), use opening_balance?
    // Usually opening_balance is the starting point.
    // If last_reconciled_balance is set, use it.
    // If this is the FIRST reconciliation, last_reconciled_balance might be null or 0.
    // If account has an "Opening Balance" transaction, it might be included in candidates?
    // Usually "Opening Balance" is a transaction.
    // Let's assume openingBalance for calculation starts at:
    // If last_reconciled_balance is NOT null, use it.
    // If it IS null, use 0? Or account.opening_balance?
    // The account.opening_balance is a property on account, often used as initial balance.
    // But if we have transactions representing the opening, we shouldn't double count.
    // Let's stick to: use last_reconciled_balance if present, else account.opening_balance.

    // Note: account.opening_balance in DB is a number.
    // Wait, if last_reconciled_balance is null, it means we haven't reconciled yet.
    // Does account.opening_balance represent a starting point that IS reconciled?
    // Typically yes.

    const startBalance = account.last_reconciled_balance ?? account.opening_balance ?? 0;

    const selectedTransactions = candidates.filter((tx) => checkedIds.has(tx.id));

    return calculateReconciliation(startBalance, selectedTransactions, statementBalance);
  }, [account, candidates, checkedIds, statementBalance]);

  const toggleTransaction = (txId: string) => {
    const newSet = new Set(checkedIds);
    if (newSet.has(txId)) {
      newSet.delete(txId);
    } else {
      newSet.add(txId);
    }
    setCheckedIds(newSet);
  };

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!activeBookset) throw new Error('No active bookset');
      await finalizeReconciliationRPC(
        activeBookset.id,
        account.id,
        statementBalance,
        statementDate,
        reconciliationState.openingBalance,
        reconciliationState.calculatedEndingBalance,
        Array.from(checkedIds)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onSuccess();
    },
  });

  const handleFinish = () => {
    if (reconciliationState.difference !== 0) {
      showError('Reconciliation requires $0 balance');
      return;
    }
    finalizeMutation.mutate();
  };

  if (isLoading) return <div>Loading transactions...</div>;
  if (error) return <div>Error loading transactions: {(error as Error).message}</div>;

  const formatMoney = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  // Format date mm/dd/yyyy
  const [yyyy, mm, dd] = statementDate.split('-');
  const formattedDate = `${mm}/${dd}/${yyyy}`;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm p-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-gray-100">
            Reconciling: {account.name}
          </h3>
          <p className="text-lg text-neutral-600 dark:text-gray-400 mt-2">
            Statement Date: {formattedDate}
          </p>
          <p className="text-lg text-neutral-600 dark:text-gray-400">
            Statement Ending Balance:{' '}
            <span className="font-bold">{formatMoney(statementBalance)}</span>
          </p>
        </div>
        <div className="text-right space-y-2">
          <div className="text-lg text-neutral-600 dark:text-gray-400">
            Target Balance:{' '}
            <span className="font-bold text-neutral-900 dark:text-gray-100">
              {formatMoney(statementBalance)}
            </span>
          </div>
          <div className="text-lg text-neutral-600 dark:text-gray-400">
            Calculated Balance:{' '}
            <span className="font-bold text-neutral-900 dark:text-gray-100">
              {formatMoney(reconciliationState.calculatedEndingBalance)}
            </span>
          </div>
          <div
            className={`text-2xl font-bold ${
              reconciliationState.difference === 0
                ? 'text-success-700 dark:text-green-400'
                : 'text-danger-700 dark:text-red-400'
            }`}
          >
            {reconciliationState.difference === 0
              ? 'Balanced ✓'
              : `Difference: ${formatMoney(reconciliationState.difference)}`}
          </div>
          <div className="flex flex-wrap gap-3 justify-end pt-2">
            <button
              onClick={handleFinish}
              disabled={finalizeMutation.isPending}
              className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
              type="button"
            >
              {finalizeMutation.isPending ? 'Finalizing...' : 'Finish Reconciliation'}
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-white dark:bg-gray-700 border-2 border-neutral-300 dark:border-gray-600 text-neutral-700 dark:text-gray-200 font-bold rounded-xl hover:bg-neutral-50 dark:hover:bg-gray-600"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-neutral-100 dark:bg-gray-700 border-b-2 border-neutral-200 dark:border-gray-600">
            <tr>
              <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-300 text-center">
                Match
              </th>
              <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-300">Date</th>
              <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-300">Payee</th>
              <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-300 text-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-gray-700 text-lg">
            {candidates.map((tx) => {
              const amount = sumTransactionAmountForReconcile(tx);
              const isChecked = checkedIds.has(tx.id);
              return (
                <tr
                  key={tx.id}
                  className={`cursor-pointer ${isChecked ? 'bg-brand-50 dark:bg-brand-900/20' : 'bg-white dark:bg-gray-800'} hover:bg-neutral-50 dark:hover:bg-gray-700`}
                  onClick={() => toggleTransaction(tx.id)}
                >
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="w-6 h-6 text-brand-600 rounded focus:ring-brand-500 border-neutral-300 dark:border-gray-500 pointer-events-none"
                    />
                  </td>
                  <td className="p-4 text-neutral-700 dark:text-gray-300">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-neutral-900 dark:text-gray-100 font-medium">
                    {tx.payee}
                  </td>
                  <td className="p-4 text-right font-bold text-neutral-900 dark:text-gray-100">
                    {formatMoney(amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
