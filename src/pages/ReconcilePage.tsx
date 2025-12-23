import { useState } from 'react';
import AppNav from '../components/AppNav';
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

  if (isLoading) return <div>Loading accounts...</div>;

  const selectedAccount = setupData ? accounts.find((a) => a.id === setupData.accountId) : null;

  return (
    <div>
      <AppNav />
      <div style={{ padding: '2rem' }}>
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
          <div style={{ textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
            <h2>Reconciliation Complete!</h2>
            <p>Your account is now balanced and transactions have been locked.</p>
            <button onClick={handleReset} style={{ padding: '0.75rem', marginTop: '1rem' }}>
              Reconcile Another Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
