import { parseHistory, formatChanges, formatAuditEntry } from './format';
import type { ChangeHistoryEntry } from '../../types/audit';

describe('audit/format', () => {
  describe('parseHistory', () => {
    it('parses valid history array', () => {
      const historyJson = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          user_id: 'user1',
          changes: {
            payee: { old: 'Old Name', new: 'New Name' },
          },
        },
      ];

      const result = parseHistory(historyJson);
      expect(result).toEqual(historyJson);
      expect(result).toHaveLength(1);
    });

    it('returns empty array for non-array input', () => {
      expect(parseHistory(null)).toEqual([]);
      expect(parseHistory(undefined)).toEqual([]);
      expect(parseHistory('string')).toEqual([]);
      expect(parseHistory(42)).toEqual([]);
      expect(parseHistory({})).toEqual([]);
    });

    it('returns empty array for empty array', () => {
      expect(parseHistory([])).toEqual([]);
    });
  });

  describe('formatChanges', () => {
    it('formats string value changes', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user1',
        changes: {
          payee: { old: 'Old Payee', new: 'New Payee' },
        },
      };

      const changes = formatChanges(entry);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toBe('Changed Payee from "Old Payee" to "New Payee"');
    });

    it('formats number value changes', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user1',
        changes: {
          amount: { old: 5000, new: 7500 },
        },
      };

      const changes = formatChanges(entry);
      expect(changes[0]).toBe('Changed Amount from "5000" to "7500"');
    });

    it('formats boolean value changes', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user1',
        changes: {
          is_reviewed: { old: false, new: true },
        },
      };

      const changes = formatChanges(entry);
      expect(changes[0]).toBe('Changed Is Reviewed from "false" to "true"');
    });

    it('formats null values as "none"', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user1',
        changes: {
          category_id: { old: null, new: 'cat123' },
        },
      };

      const changes = formatChanges(entry);
      expect(changes[0]).toBe('Changed Category Id from "none" to "cat123"');
    });

    it('formats undefined values as "none"', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user1',
        changes: {
          memo: { old: undefined, new: 'New memo' },
        },
      };

      const changes = formatChanges(entry);
      expect(changes[0]).toBe('Changed Memo from "none" to "New memo"');
    });

    it('formats snake_case field names to Title Case', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user1',
        changes: {
          payee_id: { old: null, new: 'payee123' },
          category_id: { old: 'cat1', new: 'cat2' },
          is_reviewed: { old: false, new: true },
        },
      };

      const changes = formatChanges(entry);
      expect(changes).toContain('Changed Payee Id from "none" to "payee123"');
      expect(changes).toContain('Changed Category Id from "cat1" to "cat2"');
      expect(changes).toContain('Changed Is Reviewed from "false" to "true"');
    });

    it('skips internal fields', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user1',
        changes: {
          payee: { old: 'Old', new: 'New' },
          updated_at: { old: '2024-01-01', new: '2024-01-02' },
          created_at: { old: '2024-01-01', new: '2024-01-02' },
          created_by: { old: 'user1', new: 'user2' },
          last_modified_by: { old: 'user1', new: 'user2' },
          change_history: { old: [], new: [] },
        },
      };

      const changes = formatChanges(entry);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toBe('Changed Payee from "Old" to "New"');
    });

    it('formats array values', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user1',
        changes: {
          lines: { old: [1, 2], new: [1, 2, 3] },
        },
      };

      const changes = formatChanges(entry);
      expect(changes[0]).toBe('Changed Lines from "[2 items]" to "[3 items]"');
    });

    it('formats object values as JSON', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user1',
        changes: {
          metadata: { old: { key: 'old' }, new: { key: 'new' } },
        },
      };

      const changes = formatChanges(entry);
      expect(changes[0]).toContain('Changed Metadata from');
      expect(changes[0]).toContain('"old"');
      expect(changes[0]).toContain('"new"');
    });

    it('formats Date values', () => {
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-01-02');
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user1',
        changes: {
          date: { old: oldDate, new: newDate },
        },
      };

      const changes = formatChanges(entry);
      expect(changes[0]).toContain('Changed Date from');
      expect(changes[0]).toContain(oldDate.toLocaleDateString());
      expect(changes[0]).toContain(newDate.toLocaleDateString());
    });

    it('returns empty array for entry with no changes', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user1',
        changes: {},
      };

      const changes = formatChanges(entry);
      expect(changes).toEqual([]);
    });

    it('formats multiple changes', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user1',
        changes: {
          payee: { old: 'Old Payee', new: 'New Payee' },
          amount: { old: 5000, new: 7500 },
          is_reviewed: { old: false, new: true },
        },
      };

      const changes = formatChanges(entry);
      expect(changes).toHaveLength(3);
    });
  });

  describe('formatAuditEntry', () => {
    it('formats entry with single change', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T12:00:00Z',
        user_id: 'user1',
        changes: {
          payee: { old: 'Old', new: 'New' },
        },
      };

      const result = formatAuditEntry(entry);
      expect(result).toContain('user1');
      expect(result).toContain('changed Payee');
      expect(result).toContain('from "Old" to "New"');
    });

    it('formats entry with multiple changes', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T12:00:00Z',
        user_id: 'user1',
        changes: {
          payee: { old: 'Old', new: 'New' },
          amount: { old: 5000, new: 7500 },
          is_reviewed: { old: false, new: true },
        },
      };

      const result = formatAuditEntry(entry);
      expect(result).toContain('user1 made 3 changes on');
      expect(result).toContain('2024');
    });

    it('formats entry with no changes', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T12:00:00Z',
        user_id: 'user1',
        changes: {},
      };

      const result = formatAuditEntry(entry);
      expect(result).toContain('user1 made changes on');
    });

    it('uses custom user display name when provided', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T12:00:00Z',
        user_id: 'user1',
        changes: {
          payee: { old: 'Old', new: 'New' },
        },
      };

      const result = formatAuditEntry(entry, 'John Doe');
      expect(result).toContain('John Doe');
      expect(result).not.toContain('user1');
    });

    it('formats timestamp correctly', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T12:00:00Z',
        user_id: 'user1',
        changes: {
          payee: { old: 'Old', new: 'New' },
        },
      };

      const result = formatAuditEntry(entry);
      const timestamp = new Date('2024-01-01T12:00:00Z').toLocaleString();
      expect(result).toContain(timestamp);
    });

    it('lowercases first character of single change description', () => {
      const entry: ChangeHistoryEntry = {
        timestamp: '2024-01-01T12:00:00Z',
        user_id: 'user1',
        changes: {
          payee: { old: 'Old', new: 'New' },
        },
      };

      const result = formatAuditEntry(entry);
      expect(result).toContain('changed Payee'); // lowercase 'c'
    });
  });
});
