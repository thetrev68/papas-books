import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCreateAccount, useUpdateAccount } from '../../hooks/useAccounts';
import { insertAccountSchema } from '../../lib/validation/accounts';
import type { Account } from '../../types/database';

interface AccountFormModalProps {
  account: Account | null;
  onClose: () => void;
}

export default function AccountFormModal({ account, onClose }: AccountFormModalProps) {
  const { activeBookset } = useAuth();
  const { createAccountAsync, isLoading: isCreating } = useCreateAccount();
  const { updateAccountAsync, isLoading: isUpdating } = useUpdateAccount();

  const [formData, setFormData] = useState({
    name: account?.name || '',
    type: account?.type || ('Asset' as 'Asset' | 'Liability'),
    openingBalance: account ? account.opening_balance / 100 : 0,
    openingBalanceDate: account?.opening_balance_date
      ? new Date(account.opening_balance_date).toISOString().split('T')[0]
      : '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        type: account.type,
        openingBalance: account.opening_balance / 100,
        openingBalanceDate: new Date(account.opening_balance_date).toISOString().split('T')[0],
      });
    }
  }, [account]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!activeBookset) {
      setErrors({ form: 'No active bookset' });
      return;
    }

    const validation = insertAccountSchema.safeParse({
      booksetId: activeBookset.id,
      name: formData.name,
      type: formData.type,
      openingBalance: Math.round(formData.openingBalance * 100),
      openingBalanceDate: formData.openingBalanceDate,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      if (account) {
        await updateAccountAsync(account.id, {
          name: validation.data.name,
          type: validation.data.type,
          openingBalance: validation.data.openingBalance,
          openingBalanceDate: validation.data.openingBalanceDate,
        });
      } else {
        await createAccountAsync(validation.data);
      }
      onClose();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'An error occurred' });
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          padding: '2rem',
          maxWidth: '500px',
          width: '100%',
          borderRadius: '8px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{account ? 'Edit Account' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Name:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{ width: '100%', padding: '0.5rem' }}
            />
            {errors.name && <div style={{ color: 'red', marginTop: '0.25rem' }}>{errors.name}</div>}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Type:</label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value as 'Asset' | 'Liability' })
              }
              style={{ width: '100%', padding: '0.5rem' }}
            >
              <option value="Asset">Asset</option>
              <option value="Liability">Liability</option>
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Opening Balance ($):</label>
            <input
              type="number"
              step="0.01"
              value={formData.openingBalance}
              onChange={(e) =>
                setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })
              }
              style={{ width: '100%', padding: '0.5rem' }}
            />
            {errors.openingBalance && (
              <div style={{ color: 'red', marginTop: '0.25rem' }}>{errors.openingBalance}</div>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Opening Date:</label>
            <input
              type="date"
              value={formData.openingBalanceDate}
              onChange={(e) => setFormData({ ...formData, openingBalanceDate: e.target.value })}
              style={{ width: '100%', padding: '0.5rem' }}
            />
            {errors.openingBalanceDate && (
              <div style={{ color: 'red', marginTop: '0.25rem' }}>{errors.openingBalanceDate}</div>
            )}
          </div>

          {errors.form && <div style={{ color: 'red', marginBottom: '1rem' }}>{errors.form}</div>}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
