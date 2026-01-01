import type { Transaction, Payee } from '../../types/database';
import type { CategoryWithDisplayName } from '../../lib/categoryUtils';
import PayeeSelectCell from './PayeeSelectCell';

interface WorkbenchMobileCardProps {
  transaction: Transaction;
  sortedCategories: CategoryWithDisplayName[];
  payees: Payee[];
  editingPayee: string | null;
  onUpdatePayee: (transactionId: string, newPayee: string) => void;
  onUpdateCategory: (transactionId: string, categoryId: string) => void;
  onReview: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
  onCreatePayee?: (name: string) => void;
  setEditingPayee: (id: string | null) => void;
}

/**
 * Mobile card view for a single transaction in the Workbench.
 * Extracted from WorkbenchTable to reduce component complexity.
 */
function WorkbenchMobileCard({
  transaction,
  sortedCategories,
  payees,
  editingPayee,
  onUpdatePayee,
  onUpdateCategory,
  onReview,
  onEdit,
  onCreatePayee,
  setEditingPayee,
}: WorkbenchMobileCardProps) {
  const t = transaction;
  const currentCategoryId = t.lines[0]?.category_id || '';

  return (
    <div
      className={`bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border-l-8 ${t.is_reviewed ? 'border-success-500 dark:border-green-600' : 'border-neutral-300 dark:border-gray-600'}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-neutral-500 dark:text-gray-400 font-semibold">
          {new Date(t.date).toLocaleDateString()}
        </span>
        <span
          className={`text-xl font-bold ${t.amount >= 0 ? 'text-success-700 dark:text-green-500' : 'text-danger-700 dark:text-red-500'}`}
        >
          {t.amount >= 0 ? '+' : ''}$
          {(Math.abs(t.amount) / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
      <div className="text-xl font-medium text-neutral-900 dark:text-gray-100 mb-1 truncate">
        <PayeeSelectCell
          value={t.payee || ''}
          payees={payees}
          onSave={(newValue) => onUpdatePayee(t.id, newValue)}
          onCancel={() => setEditingPayee(null)}
          isEditing={editingPayee === t.id}
          setIsEditing={(editing) => setEditingPayee(editing ? t.id : null)}
          onCreatePayee={onCreatePayee}
        />
      </div>

      <div
        className="text-sm text-neutral-500 dark:text-gray-400 italic mb-3 truncate"
        title={t.original_description}
      >
        {t.original_description}
      </div>

      <div className="mb-4">
        {t.is_split ? (
          <div className="p-3 bg-brand-50 dark:bg-brand-900 rounded-lg border border-brand-200 dark:border-brand-700 text-brand-800 dark:text-brand-200 font-bold">
            {t.lines.length} Split Lines
          </div>
        ) : (
          <select
            value={currentCategoryId}
            onChange={(e) => onUpdateCategory(t.id, e.target.value)}
            className="w-full bg-brand-50 dark:bg-gray-700 border border-brand-200 dark:border-gray-600 text-brand-900 dark:text-gray-100 py-2 px-3 rounded-lg font-bold"
          >
            <option value="">Uncategorized</option>
            {sortedCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.displayName}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onReview(t)}
          className={`flex-1 py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${
            t.is_reviewed
              ? 'bg-success-100 dark:bg-green-900 text-success-700 dark:text-green-200 border border-success-700 dark:border-green-700'
              : 'bg-brand-600 text-white shadow-md'
          }`}
        >
          {t.is_reviewed ? 'Reviewed' : 'Mark Reviewed'}
        </button>
        <button
          onClick={() => onEdit(t)}
          className="p-3 bg-white dark:bg-gray-700 border-2 border-neutral-300 dark:border-gray-600 rounded-xl text-neutral-600 dark:text-gray-300"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

export default WorkbenchMobileCard;
