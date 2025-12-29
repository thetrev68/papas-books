import { useState } from 'react';
import { useRules, useDeleteRule, useUpdateRule } from '../../hooks/useRules';
import { useCategories } from '../../hooks/useCategories';
import RuleFormModal from './RuleFormModal';
import AuditHistoryModal from '../audit/AuditHistoryModal';
import { Rule } from '../../types/database';

export default function RulesTab() {
  const { rules, isLoading, error } = useRules();
  const { deleteRule } = useDeleteRule();
  const { updateRule } = useUpdateRule();
  const { categories } = useCategories();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [historyRule, setHistoryRule] = useState<Rule | null>(null);

  function handleCreate() {
    setEditingRule(null);
    setIsFormOpen(true);
  }

  function handleEdit(rule: Rule) {
    setEditingRule(rule);
    setIsFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this rule?')) {
      await deleteRule(id);
    }
  }

  async function handleToggleEnabled(rule: Rule) {
    await updateRule(rule.id, { isEnabled: !rule.is_enabled });
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={handleCreate}
          className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 transition-colors"
        >
          Create Rule
        </button>
      </div>

      {isLoading && <div className="text-lg text-neutral-500 dark:text-gray-400">Loading...</div>}
      {error && <div className="text-danger-700">Error: {error.message}</div>}

      {!isLoading && !error && rules.length === 0 && (
        <div className="bg-neutral-50 dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 rounded-xl p-4 text-lg text-neutral-600 dark:text-gray-400">
          No rules defined yet. Create one to automate categorization!
        </div>
      )}

      {!isLoading && !error && rules.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-neutral-100 dark:bg-gray-900 border-b-2 border-neutral-200 dark:border-gray-700">
              <tr>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Priority
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Keyword
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Match Type
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Category
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Payee
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400 text-center">
                  Enabled
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Usage
                </th>
                <th className="p-4 text-base font-bold text-neutral-600 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-gray-700 text-lg">
              {rules.map((rule) => {
                const category = categories.find((c) => c.id === rule.target_category_id);

                return (
                  <tr
                    key={rule.id}
                    className={`hover:bg-neutral-50 dark:hover:bg-gray-700 ${rule.is_enabled ? '' : 'opacity-60'}`}
                  >
                    <td className="p-4">{rule.priority}</td>
                    <td className="p-4 font-medium text-neutral-900 dark:text-gray-100">
                      {rule.keyword}
                    </td>
                    <td className="p-4">{rule.match_type}</td>
                    <td className="p-4">{category?.name || 'Unknown'}</td>
                    <td className="p-4">{rule.suggested_payee || '-'}</td>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={rule.is_enabled}
                        onChange={() => handleToggleEnabled(rule)}
                        className="w-6 h-6 text-brand-600 rounded focus:ring-brand-500 border-neutral-300 dark:border-gray-600"
                      />
                    </td>
                    <td className="p-4">
                      {rule.use_count} times
                      {rule.last_used_at && (
                        <div className="text-sm text-neutral-500 dark:text-gray-400">
                          Last: {new Date(rule.last_used_at).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(rule)}
                          className="p-2 text-neutral-400 hover:text-brand-600 transition-colors"
                          title="Edit"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            ></path>
                          </svg>
                        </button>
                        <button
                          onClick={() => setHistoryRule(rule)}
                          className="p-2 text-neutral-400 hover:text-brand-600 transition-colors"
                          title="View History"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            ></path>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="p-2 text-neutral-400 hover:text-danger-700 transition-colors"
                          title="Delete"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-2.14-1.928L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            ></path>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && <RuleFormModal rule={editingRule} onClose={() => setIsFormOpen(false)} />}

      {historyRule && (
        <AuditHistoryModal
          entityType="rule"
          entityId={historyRule.id}
          entityName={`Rule: ${historyRule.keyword}`}
          isOpen={true}
          onClose={() => setHistoryRule(null)}
        />
      )}
    </div>
  );
}
