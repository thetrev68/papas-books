import { useState } from 'react';
import AppNav from '../components/AppNav';
import { useAuth } from '../context/AuthContext';
import { useApplyRules } from '../hooks/useApplyRules';
import { useWorkbenchData } from '../hooks/useWorkbenchData';
import { useTransactionMutations } from '../hooks/useTransactionMutations';
import WorkbenchTable from '../components/workbench/WorkbenchTable';
import CreateTransactionModal from '../components/workbench/CreateTransactionModal';
import RuleBatchResultModal from '../components/workbench/RuleBatchResultModal';
import SplitModal from '../components/workbench/SplitModal';
import RuleFormModal from '../components/settings/RuleFormModal';
import type { Transaction } from '../types/database';

export default function WorkbenchPage() {
  const { activeBookset } = useAuth();
  const { applyRules, isApplying, result } = useApplyRules();
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Modal states
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [splitTransaction, setSplitTransaction] = useState<Transaction | null>(null);
  const [ruleTransaction, setRuleTransaction] = useState<Transaction | null>(null);

  const { transactions, isLoading, filter, setFilter } = useWorkbenchData(activeBookset?.id || '');
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
    setEditTransaction(transaction);
  };

  const handleSplit = (transaction: Transaction) => {
    setSplitTransaction(transaction);
  };

  const handleCreateRule = (transaction: Transaction) => {
    setRuleTransaction(transaction);
  };

  const handleDelete = (transaction: Transaction) => {
    const amountStr = (transaction.amount / 100).toFixed(2);
    if (
      confirm(
        `Are you sure you want to delete the transaction with "${transaction.payee}" for $${amountStr}?`
      )
    ) {
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

  const handleUpdateCategory = (transactionId: string, categoryId: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (transaction) {
      updateTransaction({
        ...transaction,
        lines: [
          {
            ...transaction.lines[0],
            category_id: categoryId,
          },
        ],
      });
    }
  };

  const handleCreateTransaction = (transaction: Transaction) => {
    createTransaction(transaction);
    setShowCreateModal(false);
  };

  const handleSaveEdit = (transaction: Transaction) => {
    updateTransaction(transaction);
    setEditTransaction(null);
  };

  const handleSaveSplit = (transaction: Transaction) => {
    updateTransaction(transaction);
    setSplitTransaction(null);
  };

  return (
    <div>
      <AppNav />
      <div style={{ padding: '2rem' }}>
        <h1>Transaction Workbench</h1>

        <div
          style={{
            marginBottom: '1rem',
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
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

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label>Status:</label>
            <select
              value={
                filter.isReviewed === undefined
                  ? 'all'
                  : filter.isReviewed
                    ? 'reviewed'
                    : 'unreviewed'
              }
              onChange={(e) => {
                const val = e.target.value;
                setFilter({
                  isReviewed: val === 'all' ? undefined : val === 'reviewed',
                });
              }}
              style={{ padding: '4px' }}
            >
              <option value="unreviewed">Unreviewed</option>
              <option value="reviewed">Reviewed</option>
              <option value="all">All</option>
            </select>
          </div>
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
              onUpdateCategory={handleUpdateCategory}
              onCreateRule={handleCreateRule}
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

        {editTransaction && (
          <CreateTransactionModal
            accountId={activeBookset?.id || ''}
            initialTransaction={editTransaction}
            onSave={handleSaveEdit}
            onClose={() => setEditTransaction(null)}
          />
        )}

        {splitTransaction && (
          <SplitModal
            transaction={splitTransaction}
            onSave={handleSaveSplit}
            onClose={() => setSplitTransaction(null)}
          />
        )}

        {ruleTransaction && (
          <RuleFormModal
            rule={null}
            initialValues={{
              keyword: ruleTransaction.payee || ruleTransaction.original_description,
              suggestedPayee: ruleTransaction.payee,
            }}
            onClose={() => setRuleTransaction(null)}
          />
        )}

        {showResultModal && result && (
          <RuleBatchResultModal result={result} onClose={() => setShowResultModal(false)} />
        )}
      </div>
    </div>
  );
}
