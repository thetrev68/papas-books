import { useQuery } from '@tanstack/react-query';
import { parseHistory, formatChanges } from '../../lib/audit/format';
import { supabase } from '../../lib/supabase/config';
import Modal from '../ui/Modal';

type EntityType = 'transaction' | 'account' | 'category' | 'rule';

interface AuditHistoryModalProps {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface EntityWithHistory {
  change_history?: unknown;
  created_at: string;
  created_by: string;
  updated_at?: string;
  last_modified_by?: string;
}

// Map entity type to table name
const tableNames: Record<EntityType, string> = {
  transaction: 'transactions',
  account: 'accounts',
  category: 'categories',
  rule: 'rules',
};

export default function AuditHistoryModal({
  entityType,
  entityId,
  entityName,
  isOpen,
  onClose,
}: AuditHistoryModalProps) {
  // Fetch entity data with change history
  const { data: entity, isLoading } = useQuery<EntityWithHistory>({
    queryKey: ['audit-history', entityType, entityId],
    queryFn: async () => {
      const tableName = tableNames[entityType];
      const { data, error } = await supabase
        .from(tableName)
        .select('change_history, created_at, created_by, updated_at, last_modified_by')
        .eq('id', entityId)
        .single();

      if (error) throw error;
      return data as EntityWithHistory;
    },
    enabled: isOpen,
  });

  // Fetch user display names for all users mentioned in the history
  const userIds = new Set<string>();
  if (entity?.created_by) userIds.add(entity.created_by);
  if (entity?.last_modified_by) userIds.add(entity.last_modified_by);

  const history = parseHistory(entity?.change_history);
  history.forEach((entry) => {
    if (entry.user_id) userIds.add(entry.user_id);
  });

  const { data: users } = useQuery({
    queryKey: ['users', Array.from(userIds)],
    queryFn: async () => {
      if (userIds.size === 0) return [];
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, email')
        .in('id', Array.from(userIds));

      if (error) throw error;
      return data as Array<{ id: string; display_name?: string; email: string }>;
    },
    enabled: isOpen && userIds.size > 0,
  });

  // Create a map of user IDs to display names
  const userMap = new Map<string, string>();
  users?.forEach((user) => {
    userMap.set(user.id, user.display_name || user.email);
  });

  return (
    <Modal title={`Audit Trail: ${entityName}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-neutral-500 dark:text-gray-400">Loading history...</p>
        ) : history.length === 0 ? (
          <div className="space-y-4">
            <p className="text-neutral-500 dark:text-gray-400">No changes recorded yet.</p>
            {entity && (
              <div className="border-t border-neutral-200 dark:border-gray-700 pt-4">
                <p className="text-xs text-neutral-500 dark:text-gray-400">
                  Created on {new Date(entity.created_at).toLocaleString()}
                  {entity.created_by && userMap.get(entity.created_by) && (
                    <>
                      {' '}
                      by <strong>{userMap.get(entity.created_by)}</strong>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {history.reverse().map((entry, index) => {
                const userName = userMap.get(entry.user_id) || entry.user_id;
                const changes = formatChanges(entry);

                return (
                  <div
                    key={index}
                    className="border-l-2 border-blue-500 dark:border-blue-400 pl-4 pb-3"
                  >
                    <div className="flex flex-wrap justify-between text-sm text-neutral-600 dark:text-gray-300 mb-2">
                      <span className="font-semibold">{userName}</span>
                      <span className="text-neutral-500 dark:text-gray-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {changes.length > 0 ? (
                      <ul className="list-disc pl-6 text-neutral-700 dark:text-gray-300 space-y-1">
                        {changes.map((change, i) => (
                          <li key={i}>{change}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-neutral-500 dark:text-gray-400 text-sm italic">
                        No visible changes
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {entity && (
              <div className="border-t border-neutral-200 dark:border-gray-700 pt-4">
                <p className="text-xs text-neutral-500 dark:text-gray-400">
                  Created on {new Date(entity.created_at).toLocaleString()}
                  {entity.created_by && userMap.get(entity.created_by) && (
                    <>
                      {' '}
                      by <strong>{userMap.get(entity.created_by)}</strong>
                    </>
                  )}
                </p>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end pt-4">
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
