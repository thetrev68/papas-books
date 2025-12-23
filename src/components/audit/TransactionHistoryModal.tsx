import { Transaction } from '../../types/database';
import { parseHistory, formatChanges } from '../../lib/audit/format';

interface TransactionHistoryModalProps {
  transaction: Transaction;
  onClose: () => void;
}

export default function TransactionHistoryModal({
  transaction,
  onClose,
}: TransactionHistoryModalProps) {
  const history = parseHistory(transaction.change_history);

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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Transaction History</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            &times;
          </button>
        </div>

        <div className="space-y-4">
          {history.length === 0 ? (
            <p className="text-gray-500">No history available.</p>
          ) : (
            history.map((entry, index) => (
              <div key={index} className="border-b pb-2">
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  <span className="font-mono">{entry.userId}</span>
                </div>
                <ul className="list-disc pl-5 text-sm">
                  {formatChanges(entry).map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
