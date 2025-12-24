import { useState } from 'react';
import type { Transaction } from '../../types/database';
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
        <p className="text-lg text-neutral-600">
          Total Amount: ${(transaction.amount / 100).toFixed(2)}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-neutral-100 border-b-2 border-neutral-200">
              <tr>
                <th className="p-3 text-base font-bold text-neutral-600">Category</th>
                <th className="p-3 text-base font-bold text-neutral-600">Amount</th>
                <th className="p-3 text-base font-bold text-neutral-600">Memo</th>
                <th className="p-3 text-base font-bold text-neutral-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-lg">
              {lines.map((line, index) => (
                <tr key={index}>
                  <td className="p-3">
                    <select
                      value={line.category_id}
                      onChange={(e) => updateLine(index, 'category_id', e.target.value)}
                      className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
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
                      className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="text"
                      value={line.memo || ''}
                      onChange={(e) => updateLine(index, 'memo', e.target.value)}
                      className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
                    />
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => removeLine(index)}
                      className="px-4 py-2 bg-danger-100 text-danger-700 font-bold rounded-xl border border-danger-700 hover:bg-danger-200"
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
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          >
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={newLine.amount || ''}
            onChange={(e) => setNewLine({ ...newLine, amount: parseFloat(e.target.value) || 0 })}
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          />
          <input
            type="text"
            placeholder="Memo"
            value={newLine.memo}
            onChange={(e) => setNewLine({ ...newLine, memo: e.target.value })}
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          />
          <button
            onClick={addLine}
            disabled={!newLine.categoryId || newLine.amount === 0}
            className="px-4 py-3 bg-success-100 text-success-700 font-bold rounded-xl border border-success-700 hover:bg-success-200 disabled:opacity-50"
            type="button"
          >
            Add
          </button>
        </div>

        <div
          className={`p-4 rounded-xl border text-lg font-bold ${
            isValid
              ? 'bg-success-100 text-success-700 border-success-700'
              : 'bg-danger-100 text-danger-700 border-danger-700'
          }`}
        >
          Remainder: ${(remainder / 100).toFixed(2)}
          {!isValid && (
            <div className="mt-2 space-y-1 text-sm font-medium">
              {validation.errors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </div>
          )}
        </div>

        {validationError && (
          <div className="p-4 rounded-xl border bg-danger-50 border-danger-200 text-danger-700 text-sm font-medium">
            Error: {validationError}
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
            type="button"
          >
            Save Split
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

export default SplitModal;
