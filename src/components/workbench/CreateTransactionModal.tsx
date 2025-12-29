import { useState, useEffect, useMemo } from 'react';
import type { Transaction, Category } from '../../types/database';
import { createManualTransaction } from '../../lib/transactionOperations';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import Modal from '../ui/Modal';

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

  const { categories } = useCategories();
  const { payees } = usePayees();

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
        // Offer to add the payee
        if (confirm(`Payee "${formData.payee}" does not exist. Do you want to add it?`)) {
          // Save the transaction first, then open the payee modal
          saveTransaction();
          onCreatePayee(formData.payee);
        }
        // If they decline, just return without saving (stay in the modal)
      } else {
        // Fallback if no onCreatePayee handler is provided
        alert(
          `Payee "${formData.payee}" does not exist in the master payee list. Please add it to the payee list first or select an existing payee.`
        );
      }
      return;
    }

    // Payee exists or is empty, proceed with save
    saveTransaction();
  };

  const saveTransaction = () => {
    if (initialTransaction) {
      const updatedTransaction: Transaction = {
        ...initialTransaction,
        date: formData.date,
        payee: formData.payee,
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
        formData.payee,
        Math.round(formData.amount * 100), // Convert to cents
        formData.categoryId
      );
      onSave(transaction);
    }
  };

  return (
    <Modal title={initialTransaction ? 'Edit Transaction' : 'Create Transaction'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-neutral-500 mb-1">Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-neutral-500 mb-1">Payee</label>
          <input
            type="text"
            list="payees-list"
            value={formData.payee}
            onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            placeholder="Select or type payee name..."
          />
          <datalist id="payees-list">
            {payees.map((payee) => (
              <option key={payee.id} value={payee.name} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-sm font-bold text-neutral-500 mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          />
        </div>

        <label className="flex items-center gap-3 p-3 border-2 border-neutral-200 rounded-xl bg-white">
          <input
            type="checkbox"
            checked={formData.isSplit}
            onChange={(e) => setFormData({ ...formData, isSplit: e.target.checked })}
            className="w-6 h-6 text-brand-600 rounded focus:ring-brand-500 border-neutral-300"
          />
          <span className="text-lg font-medium text-neutral-900">Split Transaction</span>
        </label>

        {!formData.isSplit && (
          <div>
            <label className="block text-sm font-bold text-neutral-500 mb-1">Category</label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
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
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <span className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">
              Bank Description
            </span>
            <span className="text-neutral-700 font-mono text-sm break-all">
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
            className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
            type="button"
          >
            {initialTransaction ? 'Save' : 'Create'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white border-2 border-neutral-300 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50"
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default CreateTransactionModal;
