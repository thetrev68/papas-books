import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppNav from '../components/AppNav';
import { useAuth } from '../context/AuthContext';
import { useApplyRules } from '../hooks/useApplyRules';
import { supabase } from '../lib/supabase/config';
import RuleBatchResultModal from '../components/workbench/RuleBatchResultModal';

export default function WorkbenchPage() {
  const { activeBookset } = useAuth();
  const { applyRules, isApplying, result } = useApplyRules();
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [showResultModal, setShowResultModal] = useState(false);

  // Fetch transactions for the workbench
  // Note: In Phase 5 this will be a more sophisticated hook/grid
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions', activeBookset?.id],
    queryFn: async () => {
      if (!activeBookset) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('bookset_id', activeBookset.id)
        .order('date', { ascending: false })
        .limit(100); // Limit to 100 for basic testing in Phase 4

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeBookset,
  });

  async function handleRunRulesOnAll() {
    if (!transactions) return;

    // Filter for unreviewed transactions
    const unreviewed = transactions.filter((t) => !t.is_reviewed);
    const ids = unreviewed.map((t) => t.id);

    if (ids.length === 0) {
      alert('No unreviewed transactions to apply rules to.');
      return;
    }

    if (confirm(`Apply rules to ${ids.length} unreviewed transactions?`)) {
      await applyRules(ids);
      setShowResultModal(true);
    }
  }

  async function handleRunRulesOnSelected() {
    if (selectedTransactionIds.length === 0) {
      alert('No transactions selected.');
      return;
    }

    if (confirm(`Apply rules to ${selectedTransactionIds.length} selected transactions?`)) {
      await applyRules(selectedTransactionIds);
      setShowResultModal(true);
      setSelectedTransactionIds([]); // Clear selection
    }
  }

  return (
    <div>
      <AppNav />
      <div style={{ padding: '2rem' }}>
        <h1>Transaction Workbench</h1>

        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
          <button onClick={handleRunRulesOnAll} disabled={isApplying || isLoading}>
            {isApplying ? 'Applying Rules...' : 'Run Rules on All Unreviewed'}
          </button>
          <button
            onClick={handleRunRulesOnSelected}
            disabled={isApplying || selectedTransactionIds.length === 0}
          >
            Run Rules on Selected ({selectedTransactionIds.length})
          </button>
        </div>

        {isLoading && <div>Loading transactions...</div>}

        {!isLoading && transactions && (
          <div style={{ marginTop: '20px' }}>
            <p>Recent Transactions (Phase 4 Placeholder View):</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                  <th>Select</th>
                  <th>Date</th>
                  <th>Payee</th>
                  <th>Amount</th>
                  <th>Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedTransactionIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTransactionIds((prev) => [...prev, t.id]);
                          } else {
                            setSelectedTransactionIds((prev) => prev.filter((id) => id !== t.id));
                          }
                        }}
                      />
                    </td>
                    <td>{t.date}</td>
                    <td>{t.payee}</td>
                    <td>${(t.amount / 100).toFixed(2)}</td>
                    <td>{t.is_reviewed ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showResultModal && result && (
          <RuleBatchResultModal result={result} onClose={() => setShowResultModal(false)} />
        )}
      </div>
    </div>
  );
}
