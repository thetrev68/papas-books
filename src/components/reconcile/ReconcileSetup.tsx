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
    <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm p-6">
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-gray-100 mb-2">
        Start Reconciliation
      </h2>
      <p className="text-lg text-neutral-600 dark:text-gray-400 mb-6">
        Enter your statement details to begin.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-neutral-500 dark:text-gray-400 mb-1">
            Select Account
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
            className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:focus:ring-brand-900 outline-none"
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
        </div>

        <div>
          <label className="block text-sm font-bold text-neutral-500 dark:text-gray-400 mb-1">
            Statement Date
          </label>
          <input
            type="date"
            value={statementDate}
            onChange={(e) => setStatementDate(e.target.value)}
            required
            className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:focus:ring-brand-900 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-neutral-500 dark:text-gray-400 mb-1">
            Statement Ending Balance
          </label>
          <input
            type="number"
            step="0.01"
            value={statementBalance}
            onChange={(e) => setStatementBalance(e.target.value)}
            required
            placeholder="0.00"
            className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:focus:ring-brand-900 outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 transition-colors"
        >
          Start Reconciling
        </button>
      </form>
    </div>
  );
}
