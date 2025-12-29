import { useState } from 'react';
import { useAccounts, useDeleteAccount } from '../../hooks/useAccounts';
import AccountFormModal from './AccountFormModal';
import AuditHistoryModal from '../audit/AuditHistoryModal';
import type { Account } from '../../types/database';

export default function AccountsTab() {
  const { accounts, isLoading, error } = useAccounts();
  const { deleteAccount } = useDeleteAccount();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null);

  function handleCreate() {
    setEditingAccount(null);
    setIsFormOpen(true);
  }

  function handleEdit(account: Account) {
    setEditingAccount(account);
    setIsFormOpen(true);
  }

  function handleDelete(id: string) {
    if (confirm('Delete this account? It will be archived.')) {
      deleteAccount(id);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={handleCreate}
          className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 transition-colors"
        >
          Create Account
        </button>
      </div>

      {isLoading && <div className="text-lg text-neutral-500 dark:text-gray-400">Loading...</div>}
      {error && <div className="text-danger-700">Error: {error.message}</div>}

      {!isLoading && !error && accounts.length === 0 && (
        <div className="bg-neutral-50 dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 rounded-xl p-4 text-lg text-neutral-600 dark:text-gray-400">
          No accounts yet. Create one to get started!
        </div>
      )}

      {!isLoading && !error && accounts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-neutral-100 dark:bg-gray-900 border-b-2 border-neutral-200 dark:border-gray-700">
              <tr>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Name
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Type
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400 text-right">
                  Opening Balance
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Opening Date
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-gray-700 text-lg">
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  className="hover:bg-neutral-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                >
                  <td className="p-4 font-medium text-neutral-900 dark:text-gray-100">
                    {account.name}
                  </td>
                  <td className="p-4">{account.type}</td>
                  <td className="p-4 text-right">${(account.opening_balance / 100).toFixed(2)}</td>
                  <td className="p-4">
                    {new Date(account.opening_balance_date).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleEdit(account)}
                      className="px-3 py-1 bg-white dark:bg-gray-800 border border-neutral-300 dark:border-gray-600 text-neutral-700 dark:text-gray-300 font-bold rounded-lg hover:bg-neutral-50 dark:hover:bg-gray-700 dark:bg-gray-900 mr-2 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setHistoryAccount(account)}
                      className="px-3 py-1 bg-white dark:bg-gray-800 border border-neutral-300 dark:border-gray-600 text-neutral-700 dark:text-gray-300 font-bold rounded-lg hover:bg-neutral-50 dark:hover:bg-gray-700 dark:bg-gray-900 mr-2 text-sm"
                      title="View History"
                    >
                      History
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
                      className="px-3 py-1 bg-danger-100 dark:bg-red-700 text-danger-700 dark:text-white font-bold rounded-lg border border-danger-700 dark:border-red-600 hover:bg-danger-200 dark:hover:bg-red-600 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <AccountFormModal account={editingAccount} onClose={() => setIsFormOpen(false)} />
      )}

      {historyAccount && (
        <AuditHistoryModal
          entityType="account"
          entityId={historyAccount.id}
          entityName={historyAccount.name}
          isOpen={true}
          onClose={() => setHistoryAccount(null)}
        />
      )}
    </div>
  );
}
