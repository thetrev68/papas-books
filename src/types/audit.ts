export interface ChangeHistoryEntry {
  timestamp: string;
  userId: string;
  changes: Record<string, unknown>;
}
