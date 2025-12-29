import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApplyRules } from '../hooks/useApplyRules';
import { useWorkbenchData } from '../hooks/useWorkbenchData';
import { useTransactionMutations } from '../hooks/useTransactionMutations';
import { useOptimisticLocking } from '../hooks/useOptimisticLocking';
import WorkbenchTable from '../components/workbench/WorkbenchTable';
import CreateTransactionModal from '../components/workbench/CreateTransactionModal';
import RuleBatchResultModal from '../components/workbench/RuleBatchResultModal';
import SplitModal from '../components/workbench/SplitModal';
import RuleFormModal from '../components/settings/RuleFormModal';
import PayeeFormModal from '../components/settings/PayeeFormModal';
import { VersionConflictModal } from '../components/common/VersionConflictModal';
import type { Transaction } from '../types/database';

export default function WorkbenchPage() {
  const { activeBookset } = useAuth();
  const { applyRules, isApplying, result } = useApplyRules();
  const [showResultModal, setShowResultModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Modal states
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [splitTransaction, setSplitTransaction] = useState<Transaction | null>(null);
  const [ruleTransaction, setRuleTransaction] = useState<Transaction | null>(null);
  const [newPayeeName, setNewPayeeName] = useState<string | null>(null);

  const { transactions, isLoading, filter, setFilter } = useWorkbenchData(activeBookset?.id || '');
  const { createTransaction, updateTransaction, deleteTransaction } = useTransactionMutations();

  // Optimistic locking for concurrent edit detection
  const { conflictData, checkForConflict, resolveConflict, hasConflict, clearConflict } =
    useOptimisticLocking<Transaction>(['transactions', activeBookset?.id || '']);

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

  const handleReview = async (transaction: Transaction) => {
    const updatedTransaction = { ...transaction, is_reviewed: !transaction.is_reviewed };
    const hasConflict = await checkForConflict(transaction, updatedTransaction);
    if (hasConflict) return; // Show conflict modal
    updateTransaction(updatedTransaction);
  };

  const handleUpdatePayee = async (transactionId: string, newPayee: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (!transaction) return;

    const updatedTransaction = { ...transaction, payee: newPayee };
    const hasConflict = await checkForConflict(transaction, updatedTransaction);
    if (hasConflict) return; // Show conflict modal
    updateTransaction(updatedTransaction);
  };

  const handleUpdateCategory = async (transactionId: string, categoryId: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (!transaction) return;

    const updatedTransaction = {
      ...transaction,
      lines: [
        {
          ...transaction.lines[0],
          category_id: categoryId,
        },
      ],
    };
    const hasConflict = await checkForConflict(transaction, updatedTransaction);
    if (hasConflict) return; // Show conflict modal
    updateTransaction(updatedTransaction);
  };

  const handleCreateTransaction = (transaction: Transaction) => {
    createTransaction(transaction);
    setShowCreateModal(false);
  };

  const handleSaveEdit = async (transaction: Transaction) => {
    if (!editTransaction) return;
    const hasConflict = await checkForConflict(editTransaction, transaction);
    if (hasConflict) return; // Show conflict modal
    updateTransaction(transaction);
    setEditTransaction(null);
  };

  const handleSaveSplit = async (transaction: Transaction) => {
    if (!splitTransaction) return;
    const hasConflict = await checkForConflict(splitTransaction, transaction);
    if (hasConflict) return; // Show conflict modal
    updateTransaction(transaction);
    setSplitTransaction(null);
  };

  const handleConflictResolve = (strategy: 'overwrite' | 'reload') => {
    const resolvedRecord = resolveConflict(strategy);
    if (strategy === 'overwrite' && resolvedRecord) {
      // User chose to keep their changes - force the update
      updateTransaction(resolvedRecord);
    }
    // If reload, just clear the conflict (user discards their changes)
  };

  const handleCreatePayee = (name: string) => {
    setNewPayeeName(name);
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-neutral-900">Transaction Workbench</h1>

      <div className="flex flex-col xl:flex-row gap-4 mb-8 bg-white p-4 rounded-2xl shadow-sm border border-neutral-200">
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={isLoading}
            className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
          >
            Create Transaction
          </button>
          <button
            onClick={handleRunRulesOnAll}
            disabled={isApplying || isLoading}
            className="px-6 py-3 bg-white border-2 border-brand-600 text-brand-700 font-bold rounded-xl hover:bg-brand-50 disabled:opacity-50"
          >
            {isApplying ? 'Applying Rules...' : 'Run Rules on All Unreviewed'}
          </button>
        </div>

        <div className="xl:ml-auto flex items-center gap-4">
          <label className="font-bold text-neutral-600">Status:</label>
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
            className="p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          >
            <option value="unreviewed">Unreviewed</option>
            <option value="reviewed">Reviewed</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="text-xl p-8 text-center text-neutral-500">Loading transactions...</div>
      )}

      {!isLoading && transactions && (
        <div className="mt-6">
          <WorkbenchTable
            transactions={transactions}
            onEdit={handleEdit}
            onSplit={handleSplit}
            onDelete={handleDelete}
            onReview={handleReview}
            onUpdatePayee={handleUpdatePayee}
            onUpdateCategory={handleUpdateCategory}
            onCreateRule={handleCreateRule}
            onCreatePayee={handleCreatePayee}
          />
        </div>
      )}

      {showCreateModal && (
        <CreateTransactionModal
          accountId={activeBookset?.id || ''}
          onSave={handleCreateTransaction}
          onClose={() => setShowCreateModal(false)}
          onCreatePayee={handleCreatePayee}
        />
      )}

      {editTransaction && (
        <CreateTransactionModal
          accountId={activeBookset?.id || ''}
          initialTransaction={editTransaction}
          onSave={handleSaveEdit}
          onClose={() => setEditTransaction(null)}
          onCreatePayee={handleCreatePayee}
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
            suggestedPayee: ruleTransaction.payee ?? undefined,
          }}
          onClose={() => setRuleTransaction(null)}
        />
      )}

      {newPayeeName && (
        <PayeeFormModal initialName={newPayeeName} onClose={() => setNewPayeeName(null)} />
      )}

      {showResultModal && result && (
        <RuleBatchResultModal result={result} onClose={() => setShowResultModal(false)} />
      )}

      {hasConflict && conflictData && (
        <VersionConflictModal
          isOpen={hasConflict}
          entityType="transaction"
          entityName={conflictData.updatedRecord.payee || 'Untitled Transaction'}
          yourChanges={conflictData.updatedRecord}
          theirChanges={conflictData.serverRecord}
          onResolve={handleConflictResolve}
          onClose={() => clearConflict()}
        />
      )}
    </div>
  );
}
