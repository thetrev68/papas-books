import { useState } from 'react';
import { useAccounts, useDeleteAccount } from '../../hooks/useAccounts';
import AccountFormModal from './AccountFormModal';
import type { Account } from '../../types/database';

export default function AccountsTab() {
  const { accounts, isLoading, error } = useAccounts();
  const { deleteAccount } = useDeleteAccount();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

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
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={handleCreate}>Create Account</button>
      </div>

      {isLoading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>Error: {error.message}</div>}

      {!isLoading && !error && accounts.length === 0 && (
        <div>No accounts yet. Create one to get started!</div>
      )}

      {!isLoading && !error && accounts.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Type</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Opening Balance</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Opening Date</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{account.name}</td>
                <td style={{ padding: '0.5rem' }}>{account.type}</td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                  ${(account.openingBalance / 100).toFixed(2)}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {new Date(account.openingBalanceDate).toLocaleDateString()}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <button onClick={() => handleEdit(account)} style={{ marginRight: '0.5rem' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(account.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isFormOpen && (
        <AccountFormModal account={editingAccount} onClose={() => setIsFormOpen(false)} />
      )}
    </div>
  );
}
