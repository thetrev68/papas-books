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
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(account)}
                        className="p-2 text-neutral-400 hover:text-brand-600 transition-colors"
                        title="Edit"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          ></path>
                        </svg>
                      </button>
                      <button
                        onClick={() => setHistoryAccount(account)}
                        className="p-2 text-neutral-400 hover:text-brand-600 transition-colors"
                        title="View History"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="p-2 text-neutral-400 hover:text-danger-700 transition-colors"
                        title="Delete"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-2.14-1.928L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          ></path>
                        </svg>
                      </button>
                    </div>
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
