import { ChangeHistoryEntry } from '../../types/audit';

export function parseHistory(historyJson: unknown): ChangeHistoryEntry[] {
  if (!Array.isArray(historyJson)) {
    return [];
  }
  // Basic validation could be added here
  return historyJson as ChangeHistoryEntry[];
}

export function formatChanges(entry: ChangeHistoryEntry): string[] {
  const changes: string[] = [];

  for (const [key, value] of Object.entries(entry.changes)) {
    if (key === 'changeHistory' || key === 'updatedAt' || key === 'lastModifiedBy') continue;

    // Simple formatting for now. Could be enhanced to show old vs new if we had old values.
    // Since we only store "changes" (the new values), we just show what changed to what.
    // "Field: Value"
    let formattedValue = JSON.stringify(value);
    if (typeof value === 'string') formattedValue = value;
    if (typeof value === 'number') formattedValue = value.toString();
    if (value instanceof Date) formattedValue = value.toLocaleDateString();

    changes.push(`${key}: ${formattedValue}`);
  }

  return changes;
}
