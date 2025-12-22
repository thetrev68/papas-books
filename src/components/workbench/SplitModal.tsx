import { useState } from 'react';
import type { Transaction } from '../../types/database';
import { calculateSplitRemainder, validateSplitTransaction } from '../../lib/splitCalculator';

interface SplitModalProps {
  transaction: Transaction;
  onSave: (transaction: Transaction) => void;
  onClose: () => void;
}

function SplitModal({ transaction, onSave, onClose }: SplitModalProps) {
  const [lines, setLines] = useState(transaction.lines || []);
  const [newLine, setNewLine] = useState({ categoryId: '', amount: 0, memo: '' });

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
    }
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
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
  };

  const handleSave = () => {
    if (isValid) {
      onSave({ ...transaction, is_split: true, lines });
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Split Transaction</h3>
        <p style={{ marginBottom: '1rem' }}>
          Total Amount: ${(transaction.amount / 100).toFixed(2)}
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ccc' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Category</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Amount</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Memo</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>
                  <select
                    value={line.category_id}
                    onChange={(e) => updateLine(index, 'category_id', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '4px',
                      border: '1px solid #ccc',
                      borderRadius: '3px',
                    }}
                  >
                    <option value="">Select Category</option>
                    {/* Categories would be loaded from useCategories hook */}
                    <option value="cat1">Groceries</option>
                    <option value="cat2">Utilities</option>
                    <option value="cat3">Entertainment</option>
                  </select>
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="number"
                    step="0.01"
                    value={(line.amount / 100).toFixed(2)}
                    onChange={(e) => updateLine(index, 'amount', parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '4px',
                      border: '1px solid #ccc',
                      borderRadius: '3px',
                    }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    value={line.memo || ''}
                    onChange={(e) => updateLine(index, 'memo', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '4px',
                      border: '1px solid #ccc',
                      borderRadius: '3px',
                    }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <button
                    onClick={() => removeLine(index)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <select
            value={newLine.categoryId}
            onChange={(e) => setNewLine({ ...newLine, categoryId: e.target.value })}
            style={{ flex: 1, padding: '4px', border: '1px solid #ccc', borderRadius: '3px' }}
          >
            <option value="">Select Category</option>
            <option value="cat1">Groceries</option>
            <option value="cat2">Utilities</option>
            <option value="cat3">Entertainment</option>
          </select>
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={newLine.amount || ''}
            onChange={(e) => setNewLine({ ...newLine, amount: parseFloat(e.target.value) || 0 })}
            style={{ flex: 1, padding: '4px', border: '1px solid #ccc', borderRadius: '3px' }}
          />
          <input
            type="text"
            placeholder="Memo"
            value={newLine.memo}
            onChange={(e) => setNewLine({ ...newLine, memo: e.target.value })}
            style={{ flex: 1, padding: '4px', border: '1px solid #ccc', borderRadius: '3px' }}
          />
          <button
            onClick={addLine}
            disabled={!newLine.categoryId || newLine.amount === 0}
            style={{
              padding: '4px 8px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>

        <div
          style={{
            marginBottom: '1rem',
            padding: '8px',
            borderRadius: '4px',
            backgroundColor: isValid ? '#d4edda' : '#f8d7da',
            color: isValid ? '#155724' : '#721c24',
            border: `1px solid ${isValid ? '#c3e6cb' : '#f5c6cb'}`,
          }}
        >
          Remainder: ${(remainder / 100).toFixed(2)}
          {!isValid && (
            <div style={{ marginTop: '4px' }}>
              {validation.errors.map((error, index) => (
                <div key={index} style={{ fontSize: '12px' }}>
                  {error}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSave}
            disabled={!isValid}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: isValid ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            Save Split
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default SplitModal;
