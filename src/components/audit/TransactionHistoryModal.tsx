import { Transaction } from '../../types/database';
import { parseHistory, formatChanges } from '../../lib/audit/format';
import Modal from '../ui/Modal';

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
    <Modal title="Transaction History" onClose={onClose} size="lg">
      <div className="space-y-4">
        {history.length === 0 ? (
          <p className="text-neutral-500">No history available.</p>
        ) : (
          history.map((entry, index) => (
            <div key={index} className="border-b border-neutral-200 pb-3">
              <div className="flex flex-wrap justify-between text-sm text-neutral-500 mb-2">
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
                <span className="font-mono">{entry.userId}</span>
              </div>
              <ul className="list-disc pl-6 text-lg text-neutral-700">
                {formatChanges(entry).map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
            </div>
          ))
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white border-2 border-neutral-300 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50"
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
