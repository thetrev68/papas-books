import { RuleBatchResult } from '../../types/rules';
import Modal from '../ui/Modal';

interface RuleBatchResultModalProps {
  result: RuleBatchResult;
  onClose: () => void;
}

export default function RuleBatchResultModal({ result, onClose }: RuleBatchResultModalProps) {
  return (
    <Modal title="Rule Application Results" onClose={onClose} size="lg">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-gray-100 mb-2">Summary</h3>
          <ul className="space-y-2 text-lg text-neutral-700 dark:text-gray-300">
            <li>Total transactions: {result.totalTransactions}</li>
            <li>Rules applied: {result.appliedCount}</li>
            <li>Skipped (no match or already reviewed): {result.skippedCount}</li>
            <li>Errors: {result.errorCount}</li>
          </ul>
        </div>

        {result.errorCount > 0 && (
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-gray-100 mb-2">Errors</h3>
            <ul className="list-disc pl-6 text-neutral-700 dark:text-gray-300">
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

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white dark:bg-gray-700 border-2 border-neutral-300 dark:border-gray-600 text-neutral-700 dark:text-gray-200 font-bold rounded-xl hover:bg-neutral-50 dark:hover:bg-gray-600"
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
