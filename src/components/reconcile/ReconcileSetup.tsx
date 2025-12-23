import { useState } from 'react';
import { Account } from '../../types/database';
import { ReconciliationInput } from '../../types/reconcile';

interface ReconcileSetupProps {
  accounts: Account[];
  onNext: (input: ReconciliationInput) => void;
}

export default function ReconcileSetup({ accounts, onNext }: ReconcileSetupProps) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
  const [statementBalance, setStatementBalance] = useState(''); // Text input for easier typing, convert later

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !statementDate || statementBalance === '') return;

    // Convert balance to cents (assuming user inputs dollars like "123.45")
    const balanceInCents = Math.round(parseFloat(statementBalance) * 100);

    onNext({
      accountId,
      statementDate,
      statementBalance: balanceInCents,
    });
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h2>Start Reconciliation</h2>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Select Account
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
            style={{ padding: '0.5rem' }}
          >
            <option value="" disabled>
              Select an account
            </option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Statement Date
          <input
            type="date"
            value={statementDate}
            onChange={(e) => setStatementDate(e.target.value)}
            required
            style={{ padding: '0.5rem' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Statement Ending Balance
          <input
            type="number"
            step="0.01"
            value={statementBalance}
            onChange={(e) => setStatementBalance(e.target.value)}
            required
            placeholder="0.00"
            style={{ padding: '0.5rem' }}
          />
        </label>

        <button type="submit" style={{ padding: '0.75rem', cursor: 'pointer' }}>
          Start Reconciling
        </button>
      </form>
    </div>
  );
}
