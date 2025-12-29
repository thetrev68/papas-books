export interface ChangeValue {
  old: unknown;
  new: unknown;
}

export interface ChangeHistoryEntry {
  timestamp: string;
  user_id: string;
  changes: Record<string, ChangeValue>;
}
