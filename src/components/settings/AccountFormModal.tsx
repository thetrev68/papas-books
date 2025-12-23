import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCreateAccount, useUpdateAccount } from '../../hooks/useAccounts';
import { insertAccountSchema } from '../../lib/validation/accounts';
import type { Account } from '../../types/database';
import Modal from '../ui/Modal';

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
    <Modal title={account ? 'Edit Account' : 'Create Account'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-neutral-500 mb-1">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          />
          {errors.name && <div className="text-danger-700 mt-1 text-sm">{errors.name}</div>}
        </div>

        <div>
          <label className="block text-sm font-bold text-neutral-500 mb-1">Type</label>
          <select
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value as 'Asset' | 'Liability' })
            }
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          >
            <option value="Asset">Asset</option>
            <option value="Liability">Liability</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-neutral-500 mb-1">
            Opening Balance ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.openingBalance}
            onChange={(e) =>
              setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })
            }
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          />
          {errors.openingBalance && (
            <div className="text-danger-700 mt-1 text-sm">{errors.openingBalance}</div>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-neutral-500 mb-1">Opening Date</label>
          <input
            type="date"
            value={formData.openingBalanceDate}
            onChange={(e) => setFormData({ ...formData, openingBalanceDate: e.target.value })}
            className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
          />
          {errors.openingBalanceDate && (
            <div className="text-danger-700 mt-1 text-sm">{errors.openingBalanceDate}</div>
          )}
        </div>

        {errors.form && <div className="text-danger-700 text-sm">{errors.form}</div>}

        <div className="flex flex-wrap gap-3 justify-end">
          <button
            type="submit"
            disabled={isCreating || isUpdating}
            className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
          >
            {isCreating || isUpdating ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 bg-white border-2 border-neutral-300 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
