import { useState } from 'react';
import AppNav from '../components/AppNav';
import { useAuth } from '../context/AuthContext';
import { useApplyRules } from '../hooks/useApplyRules';
import { useWorkbenchData } from '../hooks/useWorkbenchData';
import { useTransactionMutations } from '../hooks/useTransactionMutations';
import WorkbenchTable from '../components/workbench/WorkbenchTable';
import CreateTransactionModal from '../components/workbench/CreateTransactionModal';
import RuleBatchResultModal from '../components/workbench/RuleBatchResultModal';
import type { Transaction } from '../types/database';

export default function WorkbenchPage() {
  const { activeBookset } = useAuth();
  const { applyRules, isApplying, result } = useApplyRules();
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { transactions, isLoading } = useWorkbenchData(activeBookset?.id || '');
  const { createTransaction, updateTransaction, deleteTransaction } = useTransactionMutations();

  async function handleRunRulesOnAll() {
    if (!transactions) return;

    // Filter for unreviewed transactions
    const unreviewed = transactions.filter((t) => !t.is_reviewed);
    const ids = unreviewed.map((t) => t.id);

    if (ids.length === 0) {
      alert('No unreviewed transactions to apply rules to.');
      return;
    }

    if (confirm(`Apply rules to ${ids.length} unreviewed transactions?`)) {
      await applyRules(ids);
      setShowResultModal(true);
    }
  }

  async function handleRunRulesOnSelected() {
    if (selectedTransactionIds.length === 0) {
      alert('No transactions selected.');
      return;
    }

    if (confirm(`Apply rules to ${selectedTransactionIds.length} selected transactions?`)) {
      await applyRules(selectedTransactionIds);
      setShowResultModal(true);
      setSelectedTransactionIds([]); // Clear selection
    }
  }

  const handleEdit = (transaction: Transaction) => {
    console.log('Edit transaction', transaction.id);
  };

  const handleSplit = (transaction: Transaction) => {
    console.log('Split transaction', transaction.id);
  };

  const handleDelete = (transaction: Transaction) => {
    if (confirm('Delete this transaction?')) {
      deleteTransaction(transaction.id);
    }
  };

  const handleReview = (transaction: Transaction) => {
    updateTransaction({ ...transaction, is_reviewed: !transaction.is_reviewed });
  };

  const handleUpdatePayee = (transactionId: string, newPayee: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (transaction) {
      updateTransaction({ ...transaction, payee: newPayee });
    }
  };

  const handleCreateTransaction = (transaction: Transaction) => {
    createTransaction(transaction);
    setShowCreateModal(false);
  };

  return (
    <div>
      <AppNav />
      <div style={{ padding: '2rem' }}>
        <h1>Transaction Workbench</h1>

        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
          <button onClick={() => setShowCreateModal(true)} disabled={isLoading}>
            Create Transaction
          </button>
          <button onClick={handleRunRulesOnAll} disabled={isApplying || isLoading}>
            {isApplying ? 'Applying Rules...' : 'Run Rules on All Unreviewed'}
          </button>
          <button
            onClick={handleRunRulesOnSelected}
            disabled={isApplying || selectedTransactionIds.length === 0}
          >
            Run Rules on Selected ({selectedTransactionIds.length})
          </button>
        </div>

        {isLoading && <div>Loading transactions...</div>}

        {!isLoading && transactions && (
          <div style={{ marginTop: '20px' }}>
            <WorkbenchTable
              transactions={transactions}
              onEdit={handleEdit}
              onSplit={handleSplit}
              onDelete={handleDelete}
              onReview={handleReview}
              onUpdatePayee={handleUpdatePayee}
            />
          </div>
        )}

        {showCreateModal && (
          <CreateTransactionModal
            accountId={activeBookset?.id || ''}
            onSave={handleCreateTransaction}
            onClose={() => setShowCreateModal(false)}
          />
        )}

        {showResultModal && result && (
          <RuleBatchResultModal result={result} onClose={() => setShowResultModal(false)} />
        )}
      </div>
    </div>
  );
}
