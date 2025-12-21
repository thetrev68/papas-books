import { RuleBatchResult } from '../../types/rules';

interface RuleBatchResultModalProps {
  result: RuleBatchResult;
  onClose: () => void;
}

export default function RuleBatchResultModal({ result, onClose }: RuleBatchResultModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '20px',
          maxWidth: '600px',
          width: '100%',
          borderRadius: '8px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2>Rule Application Results</h2>

        <div style={{ marginBottom: '20px' }}>
          <h3>Summary:</h3>
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            <li>Total transactions: {result.totalTransactions}</li>
            <li>Rules applied: {result.appliedCount}</li>
            <li>Skipped (no match or already reviewed): {result.skippedCount}</li>
            <li>Errors: {result.errorCount}</li>
          </ul>
        </div>

        {result.errorCount > 0 && (
          <div>
            <h3>Errors:</h3>
            <ul>
              {result.results
                .filter(
                  (r) =>
                    !r.applied &&
                    r.reason !== 'No matching rules' &&
                    r.reason !== 'Transaction already reviewed'
                )
                .map((r) => (
                  <li key={r.transactionId}>
                    Transaction {r.transactionId}: {r.reason}
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
