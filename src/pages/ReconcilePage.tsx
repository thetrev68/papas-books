import { useState } from 'react';
import { useAccounts } from '../hooks/useAccounts';
import ReconcileSetup from '../components/reconcile/ReconcileSetup';
import ReconcileWorkspace from '../components/reconcile/ReconcileWorkspace';
import { ReconciliationInput } from '../types/reconcile';

export default function ReconcilePage() {
  const { accounts, isLoading } = useAccounts();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [setupData, setSetupData] = useState<ReconciliationInput | null>(null);

  const handleSetupComplete = (data: ReconciliationInput) => {
    setSetupData(data);
    setStep(2);
  };

  const handleSuccess = () => {
    setStep(3);
  };

  const handleReset = () => {
    setSetupData(null);
    setStep(1);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto text-lg text-neutral-500 dark:text-gray-400">
        Loading accounts...
      </div>
    );
  }

  const selectedAccount = setupData ? accounts.find((a) => a.id === setupData.accountId) : null;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-gray-100 mb-2">
          Reconciliation
        </h1>
        <p className="text-lg text-neutral-600 dark:text-gray-400">
          Match your statement to lock in accurate balances.
        </p>
      </header>
      {step === 1 && <ReconcileSetup accounts={accounts} onNext={handleSetupComplete} />}

      {step === 2 && setupData && selectedAccount && (
        <ReconcileWorkspace
          account={selectedAccount}
          statementDate={setupData.statementDate}
          statementBalance={setupData.statementBalance}
          onSuccess={handleSuccess}
          onCancel={handleReset}
        />
      )}

      {step === 3 && (
        <div className="text-center max-w-md mx-auto mt-8">
          <h2 className="text-2xl font-bold mb-4">Reconciliation Complete!</h2>
          <p className="text-lg text-neutral-600 dark:text-gray-400 mb-6">
            Your account is now balanced and transactions have been locked.
          </p>
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors"
          >
            Reconcile Another Account
          </button>
        </div>
      )}
    </div>
  );
}
