import { ChangeHistoryEntry } from '../../types/audit';

export function parseHistory(historyJson: unknown): ChangeHistoryEntry[] {
  if (!Array.isArray(historyJson)) {
    return [];
  }
  // Basic validation could be added here
  return historyJson as ChangeHistoryEntry[];
}

/**
 * Format a single value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'none';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Convert snake_case to Title Case
 */
function formatFieldName(fieldName: string): string {
  return fieldName.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Format a single change entry into human-readable strings
 */
export function formatChanges(entry: ChangeHistoryEntry): string[] {
  const changes: string[] = [];

  // Skip internal fields
  const skipFields = [
    'change_history',
    'updated_at',
    'last_modified_by',
    'created_at',
    'created_by',
  ];

  for (const [key, changeValue] of Object.entries(entry.changes)) {
    if (skipFields.includes(key)) continue;

    const fieldName = formatFieldName(key);
    const oldValue = formatValue(changeValue.old);
    const newValue = formatValue(changeValue.new);

    changes.push(`Changed ${fieldName} from "${oldValue}" to "${newValue}"`);
  }

  return changes;
}

/**
 * Format a full audit entry into a human-readable sentence
 */
export function formatAuditEntry(entry: ChangeHistoryEntry, userDisplayName?: string): string {
  const changes = formatChanges(entry);
  const timestamp = new Date(entry.timestamp).toLocaleString();
  const user = userDisplayName || entry.user_id;

  if (changes.length === 0) {
    return `${user} made changes on ${timestamp}`;
  }

  if (changes.length === 1) {
    return `${user} ${changes[0].charAt(0).toLowerCase() + changes[0].slice(1)} on ${timestamp}`;
  }

  return `${user} made ${changes.length} changes on ${timestamp}`;
}
