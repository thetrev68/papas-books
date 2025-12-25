import type { VersionedRecord } from '../../hooks/useOptimisticLocking';

interface VersionConflictModalProps<T extends VersionedRecord> {
  isOpen: boolean;
  entityType: string;
  entityName: string;
  yourChanges: Partial<T>;
  theirChanges: T;
  onResolve: (strategy: 'overwrite' | 'reload') => void;
  onClose: () => void;
}

/**
 * Modal shown when a concurrent edit conflict is detected.
 *
 * Displays both versions of the record and allows the user to choose:
 * - Reload: Discard their changes and use the other user's version
 * - Overwrite: Keep their changes and overwrite the other user's version
 *
 * @example
 * ```tsx
 * <VersionConflictModal
 *   isOpen={!!conflictRecord}
 *   entityType="transaction"
 *   entityName={transaction.payee || 'Untitled'}
 *   yourChanges={updatedTransaction}
 *   theirChanges={conflictRecord}
 *   onResolve={(strategy) => {
 *     if (strategy === 'overwrite') {
 *       // Force save
 *     } else {
 *       // Reload from server
 *     }
 *   }}
 *   onClose={() => setConflictRecord(null)}
 * />
 * ```
 */
export function VersionConflictModal<T extends VersionedRecord>({
  isOpen,
  entityType,
  entityName,
  yourChanges,
  theirChanges,
  onResolve,
  onClose,
}: VersionConflictModalProps<T>) {
  if (!isOpen) return null;

  const modifiedBy = theirChanges.last_modified_by || 'Another user';
  const modifiedAt = new Date(theirChanges.updated_at).toLocaleString();

  // Find changed fields
  const changedFields = Object.keys(yourChanges).filter((key) => {
    if (key === 'id' || key === 'updated_at' || key === 'created_at') return false;
    return yourChanges[key as keyof T] !== theirChanges[key as keyof T];
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">Concurrent Edit Detected</h2>
          <p className="text-sm text-gray-600 mt-1">
            {entityType.charAt(0).toUpperCase() + entityType.slice(1)}:{' '}
            <strong>{entityName}</strong>
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  This {entityType} was modified by {modifiedBy}
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Last updated: {modifiedAt}
                  <br />
                  Your changes conflict with theirs. Choose how to resolve this conflict.
                </p>
              </div>
            </div>
          </div>

          {changedFields.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Changed Fields:</h3>
              <div className="space-y-3">
                {changedFields.map((field) => (
                  <div key={field} className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        {field.replace(/_/g, ' ').toUpperCase()}
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <div className="text-xs text-gray-500 mb-1">Your version:</div>
                        <div className="text-gray-900 font-mono text-xs break-all">
                          {formatValue(yourChanges[field as keyof T])}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1">&nbsp;</div>
                      <div className="bg-green-50 border border-green-200 rounded p-2">
                        <div className="text-xs text-gray-500 mb-1">Their version:</div>
                        <div className="text-gray-900 font-mono text-xs break-all">
                          {formatValue(theirChanges[field as keyof T])}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 flex gap-3">
          <button
            onClick={() => onResolve('reload')}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            <div className="text-sm font-medium">Discard My Changes</div>
            <div className="text-xs text-gray-500">Use their version</div>
          </button>
          <button
            onClick={() => onResolve('overwrite')}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div className="text-sm font-medium">Keep My Changes</div>
            <div className="text-xs text-blue-100">Overwrite their version</div>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Formats a value for display in the conflict modal.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
