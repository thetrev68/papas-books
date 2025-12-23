import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Account } from '../../types/database';
import {
  fetchUnreconciledTransactions,
  finalizeReconciliationRPC,
} from '../../lib/supabase/reconcile';
import { calculateReconciliation, sumTransactionAmountForReconcile } from '../../lib/reconciler';
import { useAuth } from '../../context/AuthContext';

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

  if (isLoading) return <div>Loading transactions...</div>;
  if (error) return <div>Error loading transactions: {(error as Error).message}</div>;

  const formatMoney = (cents: number) => (cents / 100).toFixed(2);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h3>Reconciling: {account.name}</h3>
          <p>Statement Date: {statementDate}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>Target Balance: {formatMoney(statementBalance)}</div>
          <div>Calculated Balance: {formatMoney(reconciliationState.calculatedEndingBalance)}</div>
          <div
            style={{
              fontWeight: 'bold',
              color: reconciliationState.difference === 0 ? 'green' : 'red',
            }}
          >
            Difference: {formatMoney(reconciliationState.difference)}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <button
              onClick={() => finalizeMutation.mutate()}
              disabled={!reconciliationState.isBalanced || finalizeMutation.isPending}
              style={{ marginRight: '0.5rem' }}
            >
              {finalizeMutation.isPending ? 'Finalizing...' : 'Finish Reconciliation'}
            </button>
            <button onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>

      <table border={1} cellPadding={5} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>X</th>
            <th>Date</th>
            <th>Payee</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((tx) => {
            const amount = sumTransactionAmountForReconcile(tx);
            const isChecked = checkedIds.has(tx.id);
            return (
              <tr
                key={tx.id}
                style={{ cursor: 'pointer', background: isChecked ? '#e0f7fa' : 'transparent' }}
                onClick={() => toggleTransaction(tx.id)}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // Handled by tr onClick
                    style={{ pointerEvents: 'none' }}
                  />
                </td>
                <td>{tx.date}</td>
                <td>{tx.payee}</td>
                <td>{formatMoney(amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
