import { useState, useEffect } from 'react';
import type { Transaction } from '../../types/database';
import { createManualTransaction } from '../../lib/transactionOperations';
import { useCategories } from '../../hooks/useCategories';

interface CreateTransactionModalProps {
  accountId: string;
  initialTransaction?: Transaction;
  onSave: (transaction: Transaction) => void;
  onClose: () => void;
}

function CreateTransactionModal({
  accountId,
  initialTransaction,
  onSave,
  onClose,
}: CreateTransactionModalProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    payee: '',
    amount: 0,
    categoryId: '',
    isSplit: false,
  });

  const { categories } = useCategories();

  useEffect(() => {
    if (initialTransaction) {
      setFormData({
        date: initialTransaction.date.split('T')[0],
        payee: initialTransaction.payee,
        amount: initialTransaction.amount / 100,
        categoryId: initialTransaction.lines[0]?.category_id || '',
        isSplit: initialTransaction.is_split,
      });
    }
  }, [initialTransaction]);

  const handleSave = () => {
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
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          {initialTransaction ? 'Edit Transaction' : 'Create Transaction'}
        </h3>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Date:</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Payee:</label>
          <input
            type="text"
            value={formData.payee}
            onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Amount:</label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            <input
              type="checkbox"
              checked={formData.isSplit}
              onChange={(e) => setFormData({ ...formData, isSplit: e.target.checked })}
              style={{ marginRight: '0.5rem' }}
            />
            Split Transaction
          </label>
        </div>

        {!formData.isSplit && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Category:</label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSave}
            disabled={
              !formData.payee ||
              formData.amount === 0 ||
              (!formData.isSplit && !formData.categoryId)
            }
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {initialTransaction ? 'Save' : 'Create'}
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

export default CreateTransactionModal;
