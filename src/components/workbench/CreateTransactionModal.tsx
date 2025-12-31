import { useState, useEffect, useMemo } from 'react';
import type { Transaction, Category } from '../../types/database';
import { createManualTransaction } from '../../lib/transactionOperations';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { sanitizeText, MAX_PAYEE_LENGTH } from '../../lib/validation/import';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../GlobalToastProvider';

interface CreateTransactionModalProps {
  accountId: string;
  initialTransaction?: Transaction;
  onSave: (transaction: Transaction) => void;
  onClose: () => void;
  onCreatePayee?: (name: string) => void;
}

function CreateTransactionModal({
  accountId,
  initialTransaction,
  onSave,
  onClose,
  onCreatePayee,
}: CreateTransactionModalProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    payee: '',
    amount: 0,
    categoryId: '',
    isSplit: false,
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    payeeName: string;
  } | null>(null);

  const { categories } = useCategories();
  const { payees } = usePayees();
  const { showError } = useToast();

  // Helper to process categories with parent:child format
  const sortedCategories = useMemo(() => {
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const getRoot = (cat: Category): Category => {
      let current = cat;
      const seen = new Set<string>();
      while (current.parent_category_id && categoryMap.has(current.parent_category_id)) {
        if (seen.has(current.id)) break;
        seen.add(current.id);
        current = categoryMap.get(current.parent_category_id)!;
      }
      return current;
    };

    const getFullName = (cat: Category) => {
      if (!cat.parent_category_id) return cat.name;
      const parent = categoryMap.get(cat.parent_category_id);
      return parent ? `${parent.name}: ${cat.name}` : cat.name;
    };

    return [...categories]
      .sort((a, b) => {
        const rootA = getRoot(a);
        const rootB = getRoot(b);
        const isIncomeA = rootA.name === 'Income';
        const isIncomeB = rootB.name === 'Income';

        if (isIncomeA && !isIncomeB) return -1;
        if (!isIncomeA && isIncomeB) return 1;

        return getFullName(a).localeCompare(getFullName(b));
      })
      .map((cat) => ({
        ...cat,
        displayName: getFullName(cat),
      }));
  }, [categories]);

  useEffect(() => {
    if (initialTransaction) {
      setFormData({
        date: initialTransaction.date.split('T')[0],
        payee: initialTransaction.payee || '',
        amount: initialTransaction.amount / 100,
        categoryId: initialTransaction.lines[0]?.category_id || '',
        isSplit: initialTransaction.is_split,
      });
    }
  }, [initialTransaction]);

  const handleSave = () => {
    // Validate payee exists in the master list
    const payeeExists = payees.some(
      (p) => p.name.toLowerCase() === formData.payee.trim().toLowerCase()
    );

    if (formData.payee.trim() && !payeeExists) {
      if (onCreatePayee) {
        // Show confirmation dialog to add the payee
        setConfirmDialog({ payeeName: formData.payee });
      } else {
        // Fallback if no onCreatePayee handler is provided
        showError(
          `Payee "${formData.payee}" does not exist in the master payee list. Please add it to the payee list first or select an existing payee.`
        );
      }
      return;
    }

    // Payee exists or is empty, proceed with save
    saveTransaction();
  };

  const handleConfirmAddPayee = () => {
    if (confirmDialog && onCreatePayee) {
      // Save the transaction first, then open the payee modal
      saveTransaction();
      onCreatePayee(confirmDialog.payeeName);
      setConfirmDialog(null);
    }
  };

  const handleCancelAddPayee = () => {
    setConfirmDialog(null);
  };

  const saveTransaction = () => {
    const sanitizedPayee = sanitizeText(formData.payee, MAX_PAYEE_LENGTH);

    if (initialTransaction) {
      const updatedTransaction: Transaction = {
        ...initialTransaction,
        date: formData.date,
        payee: sanitizedPayee,
        amount: Math.round(formData.amount * 100),
        is_split: formData.isSplit,
        lines: formData.isSplit
          ? initialTransaction.lines
          : [
              {
                category_id: formData.categoryId,
                amount: Math.round(formData.amount * 100),
                memo: '',
              },
            ],
      };
      onSave(updatedTransaction);
    } else {
      const transaction = createManualTransaction(
        accountId,
        formData.date,
        sanitizedPayee,
        Math.round(formData.amount * 100), // Convert to cents
        formData.categoryId
      );
      onSave(transaction);
    }
  };

  return (
    <>
      {confirmDialog && (
        <ConfirmDialog
          title="Add New Payee"
          message={`Payee "${confirmDialog.payeeName}" does not exist. Do you want to add it?`}
          confirmLabel="Add Payee"
          cancelLabel="Cancel"
          onConfirm={handleConfirmAddPayee}
          onCancel={handleCancelAddPayee}
        />
      )}

      <Modal
        title={initialTransaction ? 'Edit Transaction' : 'Create Transaction'}
        onClose={onClose}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-600 dark:text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-600 dark:text-gray-400 mb-1">Payee</label>
            <input
              type="text"
              list="payees-list"
              value={formData.payee}
              onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
              className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
              placeholder="Select or type payee name..."
            />
            <datalist id="payees-list">
              {payees.map((payee) => (
                <option key={payee.id} value={payee.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm text-neutral-600 dark:text-gray-400 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
              }
              className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            />
          </div>

          <label className="flex items-center gap-3 p-3 border-2 border-neutral-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700">
            <input
              type="checkbox"
              checked={formData.isSplit}
              onChange={(e) => setFormData({ ...formData, isSplit: e.target.checked })}
              className="w-6 h-6 text-brand-600 rounded focus:ring-brand-500 border-neutral-300 dark:border-gray-600"
            />
            <span className="text-lg text-neutral-900 dark:text-gray-100">Split Transaction</span>
          </label>

          {!formData.isSplit && (
            <div>
              <label className="block text-sm text-neutral-600 dark:text-gray-400 mb-1">
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
              >
                <option value="">Select Category</option>
                {sortedCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {initialTransaction?.original_description && (
            <div className="bg-neutral-50 dark:bg-gray-700 p-3 rounded-xl border border-neutral-200 dark:border-gray-600">
              <span className="block text-xs text-neutral-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                Bank Description
              </span>
              <span className="text-neutral-900 dark:text-gray-100 font-mono text-sm break-all">
                {initialTransaction.original_description}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-end">
            <button
              onClick={handleSave}
              disabled={
                !formData.payee ||
                formData.amount === 0 ||
                (!formData.isSplit && !formData.categoryId)
              }
              className="px-6 py-3 bg-brand-600 text-white rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
              type="button"
            >
              {initialTransaction ? 'Save' : 'Create'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white dark:bg-gray-700 border-2 border-neutral-300 dark:border-gray-600 text-neutral-700 dark:text-gray-200 rounded-xl hover:bg-neutral-50 dark:hover:bg-gray-600"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default CreateTransactionModal;
