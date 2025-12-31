import { useState, useMemo } from 'react';
import type { Transaction, Category } from '../../types/database';
import { calculateSplitRemainder, validateSplitTransaction } from '../../lib/splitCalculator';
import { validateSplitLines } from '../../lib/validation/splits';
import { useCategories } from '../../hooks/useCategories';
import Modal from '../ui/Modal';

interface SplitModalProps {
  transaction: Transaction;
  onSave: (transaction: Transaction) => void;
  onClose: () => void;
}

function SplitModal({ transaction, onSave, onClose }: SplitModalProps) {
  const [lines, setLines] = useState(transaction.lines || []);
  const [newLine, setNewLine] = useState({ categoryId: '', amount: 0, memo: '' });
  const [validationError, setValidationError] = useState<string | null>(null);
  const { categories } = useCategories();

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

  const remainder = calculateSplitRemainder({ ...transaction, lines });
  const validation = validateSplitTransaction({ ...transaction, lines });
  const isValid = validation.isValid;

  const addLine = () => {
    if (newLine.categoryId && newLine.amount !== 0) {
      setLines([
        ...lines,
        {
          category_id: newLine.categoryId,
          amount: Math.round(newLine.amount * 100), // Convert to cents
          memo: newLine.memo,
        },
      ]);
      setNewLine({ categoryId: '', amount: 0, memo: '' });
      setValidationError(null); // Clear error on change
    }
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
    setValidationError(null); // Clear error on change
  };

  const updateLine = (
    index: number,
    field: 'category_id' | 'amount' | 'memo',
    value: string | number
  ) => {
    const updatedLines = [...lines];
    if (field === 'amount' && typeof value === 'number') {
      updatedLines[index] = { ...updatedLines[index], [field]: Math.round(value * 100) };
    } else {
      updatedLines[index] = { ...updatedLines[index], [field]: value };
    }
    setLines(updatedLines);
    setValidationError(null); // Clear error on change
  };

  const handleSave = async () => {
    // Client-side math check
    if (!isValid) return;

    // Async DB validation
    const result = await validateSplitLines(lines, transaction.bookset_id);

    if (!result.valid) {
      setValidationError(result.errors.join('; '));
      return;
    }

    onSave({ ...transaction, is_split: true, lines });
  };

  return (
    <Modal title="Split Transaction" onClose={onClose} size="lg">
      <div className="space-y-4">
        <p className="text-lg text-neutral-600 dark:text-gray-300">
          Total Amount: ${(transaction.amount / 100).toFixed(2)}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-neutral-100 dark:bg-gray-700 border-b-2 border-neutral-200 dark:border-gray-600">
              <tr>
                <th className="p-3 text-base text-neutral-600 dark:text-gray-300">Category</th>
                <th className="p-3 text-base text-neutral-600 dark:text-gray-300">Amount</th>
                <th className="p-3 text-base text-neutral-600 dark:text-gray-300">Memo</th>
                <th className="p-3 text-base text-neutral-600 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-gray-700 text-lg">
              {lines.map((line, index) => (
                <tr key={index}>
                  <td className="p-3">
                    <select
                      value={line.category_id}
                      onChange={(e) => updateLine(index, 'category_id', e.target.value)}
                      className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
                    >
                      <option value="">Select Category</option>
                      {sortedCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.displayName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      step="0.01"
                      value={(line.amount / 100).toFixed(2)}
                      onChange={(e) => updateLine(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="text"
                      value={line.memo || ''}
                      onChange={(e) => updateLine(index, 'memo', e.target.value)}
                      className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
                    />
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => removeLine(index)}
                      className="px-4 py-2 bg-danger-100 dark:bg-red-900 text-danger-700 dark:text-red-200 rounded-xl border border-danger-700 dark:border-red-700 hover:bg-danger-200 dark:hover:bg-red-800"
                      type="button"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={newLine.categoryId}
            onChange={(e) => setNewLine({ ...newLine, categoryId: e.target.value })}
            className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          >
            <option value="">Select Category</option>
            {sortedCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.displayName}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={newLine.amount || ''}
            onChange={(e) => setNewLine({ ...newLine, amount: parseFloat(e.target.value) || 0 })}
            className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          />
          <input
            type="text"
            placeholder="Memo"
            value={newLine.memo}
            onChange={(e) => setNewLine({ ...newLine, memo: e.target.value })}
            className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          />
          <button
            onClick={addLine}
            disabled={!newLine.categoryId || newLine.amount === 0}
            className="px-4 py-3 bg-success-100 dark:bg-green-900 text-success-700 dark:text-green-200 rounded-xl border border-success-700 dark:border-green-700 hover:bg-success-200 dark:hover:bg-green-800 disabled:opacity-50"
            type="button"
          >
            Add
          </button>
        </div>

        <div
          className={`p-4 rounded-xl border text-lg ${
            isValid
              ? 'bg-success-100 dark:bg-green-900/30 text-success-700 dark:text-green-300 border-success-700 dark:border-green-700'
              : 'bg-danger-100 dark:bg-red-900/30 text-danger-700 dark:text-red-300 border-danger-700 dark:border-red-700'
          }`}
        >
          Remainder: ${(remainder / 100).toFixed(2)}
          {!isValid && (
            <div className="mt-2 space-y-1 text-sm">
              {validation.errors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </div>
          )}
        </div>

        {validationError && (
          <div className="p-4 rounded-xl border bg-danger-50 dark:bg-red-900/20 border-danger-200 dark:border-red-800 text-danger-700 dark:text-red-300 text-sm">
            Error: {validationError}
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-6 py-3 bg-brand-600 text-white rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
            type="button"
          >
            Save Split
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
  );
}

export default SplitModal;
