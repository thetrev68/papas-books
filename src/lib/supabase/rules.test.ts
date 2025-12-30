/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRules, createRule, updateRule, deleteRule } from './rules';
import { supabase } from './config';
import { DatabaseError } from '../errors';
import { mockRule } from '../../test-utils/fixtures';
import type { InsertRule, UpdateRule } from '../../types/rules';

// Mock the Supabase client
vi.mock('./config', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('fetchRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch rules for a bookset ordered by priority', async () => {
    const mockData = [
      mockRule({ id: 'rule-1', priority: 10 }),
      mockRule({ id: 'rule-2', priority: 5 }),
      mockRule({ id: 'rule-3', priority: 1 }),
    ];

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchRules('test-bookset-id');

    expect(supabase.from).toHaveBeenCalledWith('rules');
    expect(mockQuery.select).toHaveBeenCalledWith('*');
    expect(mockQuery.eq).toHaveBeenCalledWith('bookset_id', 'test-bookset-id');
    expect(mockQuery.order).toHaveBeenCalledWith('priority', { ascending: false });
    expect(result).toEqual(mockData);
  });

  it('should include both enabled and disabled rules', async () => {
    const mockData = [
      mockRule({ id: 'rule-1', is_enabled: true }),
      mockRule({ id: 'rule-2', is_enabled: false }),
    ];

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchRules('test-bookset-id');

    expect(result).toHaveLength(2);
    expect(result[0].is_enabled).toBe(true);
    expect(result[1].is_enabled).toBe(false);
  });

  it('should return empty array when no rules found', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchRules('test-bookset-id');

    expect(result).toEqual([]);
  });

  it('should throw DatabaseError on Supabase error', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: '42501' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(fetchRules('test-bookset-id')).rejects.toThrow(DatabaseError);
  });
});

describe('createRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new rule with keyword normalized to lowercase', async () => {
    const newRule: InsertRule = {
      booksetId: 'test-bookset-id',
      keyword: 'WALMART',
      matchType: 'contains',
      caseSensitive: false,
      targetCategoryId: 'category-id',
      priority: 5,
      isEnabled: true,
    };

    const createdRule = mockRule({
      keyword: 'walmart', // Normalized to lowercase
      match_type: 'contains',
      case_sensitive: false,
      target_category_id: 'category-id',
      priority: 5,
    });

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdRule, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await createRule(newRule);

    expect(supabase.from).toHaveBeenCalledWith('rules');
    expect(mockQuery.insert).toHaveBeenCalledWith({
      bookset_id: newRule.booksetId,
      keyword: 'walmart', // Should be lowercase
      match_type: newRule.matchType,
      case_sensitive: newRule.caseSensitive,
      target_category_id: newRule.targetCategoryId,
      suggested_payee: null,
      priority: newRule.priority,
      is_enabled: newRule.isEnabled,
      use_count: 0,
      last_used_at: null,
      conditions: null,
    });
    expect(result).toEqual(createdRule);
  });

  it('should create rule with suggested payee', async () => {
    const newRule: InsertRule = {
      booksetId: 'test-bookset-id',
      keyword: 'starbucks',
      matchType: 'contains',
      caseSensitive: false,
      targetCategoryId: 'category-id',
      suggestedPayee: 'Starbucks Coffee',
      priority: 0,
      isEnabled: true,
    };

    const createdRule = mockRule({
      keyword: 'starbucks',
      suggested_payee: 'Starbucks Coffee',
    });

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdRule, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await createRule(newRule);

    expect(mockQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        suggested_payee: 'Starbucks Coffee',
      })
    );
  });

  it('should create rule with different match types', async () => {
    const matchTypes = ['contains', 'exact', 'startsWith', 'regex'] as const;

    for (const matchType of matchTypes) {
      vi.clearAllMocks();

      const newRule: InsertRule = {
        booksetId: 'test-bookset-id',
        keyword: 'test',
        matchType,
        caseSensitive: false,
        targetCategoryId: 'category-id',
        priority: 0,
        isEnabled: true,
      };

      const createdRule = mockRule({ match_type: matchType });

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createdRule, error: null }),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      await createRule(newRule);

      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          match_type: matchType,
        })
      );
    }
  });

  it('should create rule with conditions', async () => {
    const newRule: InsertRule = {
      booksetId: 'test-bookset-id',
      keyword: 'amazon',
      matchType: 'contains',
      caseSensitive: false,
      targetCategoryId: 'category-id',
      priority: 0,
      isEnabled: true,
      conditions: {
        amountMin: 1000,
        amountMax: 5000,
        dateRange: {
          startMonth: 1,
          endMonth: 12,
        },
      },
    };

    const createdRule = mockRule({
      keyword: 'amazon',
    });

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdRule, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await createRule(newRule);

    expect(mockQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conditions: {
          amountMin: 1000,
          amountMax: 5000,
          dateRange: {
            startMonth: 1,
            endMonth: 12,
          },
        },
      })
    );
  });

  it('should throw DatabaseError on creation failure', async () => {
    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Foreign key violation', code: '23503' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const newRule: InsertRule = {
      booksetId: 'test-bookset-id',
      keyword: 'test',
      matchType: 'contains',
      caseSensitive: false,
      targetCategoryId: 'nonexistent-category',
      priority: 0,
      isEnabled: true,
    };

    await expect(createRule(newRule)).rejects.toThrow(DatabaseError);
  });

  it('should normalize mixed-case keywords to lowercase', async () => {
    const newRule: InsertRule = {
      booksetId: 'test-bookset-id',
      keyword: 'AmaZOn PrImE',
      matchType: 'contains',
      caseSensitive: false,
      targetCategoryId: 'category-id',
      priority: 0,
      isEnabled: true,
    };

    const createdRule = mockRule({ keyword: 'amazon prime' });

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdRule, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await createRule(newRule);

    expect(mockQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        keyword: 'amazon prime',
      })
    );
  });
});

describe('updateRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update rule with optimistic locking', async () => {
    const updates: UpdateRule = {
      keyword: 'UPDATED KEYWORD',
      matchType: 'exact',
      priority: 10,
      updatedAt: '2024-01-15T10:00:00Z',
    };

    const updatedRule = mockRule({
      keyword: 'updated keyword', // Normalized
      match_type: 'exact',
      priority: 10,
      updated_at: '2024-01-15T10:30:00Z',
    });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedRule, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await updateRule('rule-id-123', updates);

    expect(mockQuery.update).toHaveBeenCalledWith({
      keyword: 'updated keyword', // Should be lowercase
      match_type: 'exact',
      priority: 10,
    });
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'rule-id-123');
    expect(mockQuery.eq).toHaveBeenCalledWith('updated_at', updates.updatedAt);
    expect(result).toEqual(updatedRule);
  });

  it('should skip version check when option is set', async () => {
    const updates: UpdateRule = {
      priority: 15,
    };

    const updatedRule = mockRule({ priority: 15 });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedRule, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateRule('rule-id-123', updates, { skipVersionCheck: true });

    // Should only have one eq call (for id), not two (id + updated_at)
    expect(mockQuery.eq).toHaveBeenCalledTimes(1);
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'rule-id-123');
  });

  it('should normalize keyword to lowercase when updating', async () => {
    const updates: UpdateRule = {
      keyword: 'TARGET STORE',
    };

    const updatedRule = mockRule({ keyword: 'target store' });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedRule, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateRule('rule-id-123', updates, { skipVersionCheck: true });

    expect(mockQuery.update).toHaveBeenCalledWith({
      keyword: 'target store',
    });
  });

  it('should update suggested payee', async () => {
    const updates: UpdateRule = {
      suggestedPayee: 'New Payee Name',
    };

    const updatedRule = mockRule({ suggested_payee: 'New Payee Name' });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedRule, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateRule('rule-id-123', updates, { skipVersionCheck: true });

    expect(mockQuery.update).toHaveBeenCalledWith({
      suggested_payee: 'New Payee Name',
    });
  });

  it('should update target category', async () => {
    const updates: UpdateRule = {
      targetCategoryId: 'new-category-id',
    };

    const updatedRule = mockRule({ target_category_id: 'new-category-id' });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedRule, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateRule('rule-id-123', updates, { skipVersionCheck: true });

    expect(mockQuery.update).toHaveBeenCalledWith({
      target_category_id: 'new-category-id',
    });
  });

  it('should enable or disable rule', async () => {
    const updates: UpdateRule = {
      isEnabled: false,
    };

    const updatedRule = mockRule({ is_enabled: false });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedRule, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateRule('rule-id-123', updates, { skipVersionCheck: true });

    expect(mockQuery.update).toHaveBeenCalledWith({
      is_enabled: false,
    });
  });

  it('should update case sensitivity', async () => {
    const updates: UpdateRule = {
      caseSensitive: true,
    };

    const updatedRule = mockRule({ case_sensitive: true });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedRule, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateRule('rule-id-123', updates, { skipVersionCheck: true });

    expect(mockQuery.update).toHaveBeenCalledWith({
      case_sensitive: true,
    });
  });

  it('should update conditions', async () => {
    const updates: UpdateRule = {
      conditions: {
        amountMin: 500,
        amountMax: 10000,
        descriptionRegex: '^AMAZON.*',
      },
    };

    const updatedRule = mockRule();

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedRule, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateRule('rule-id-123', updates, { skipVersionCheck: true });

    expect(mockQuery.update).toHaveBeenCalledWith({
      conditions: {
        amountMin: 500,
        amountMax: 10000,
        descriptionRegex: '^AMAZON.*',
      },
    });
  });

  it('should throw CONCURRENT_EDIT error when version conflict occurs', async () => {
    const updates: UpdateRule = {
      priority: 20,
      updatedAt: '2024-01-15T10:00:00Z',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows updated' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(updateRule('rule-id-123', updates)).rejects.toThrow(DatabaseError);
    await expect(updateRule('rule-id-123', updates)).rejects.toThrow(/modified by another user/);
  });

  it('should throw CONCURRENT_EDIT when no data returned', async () => {
    const updates: UpdateRule = {
      priority: 20,
      updatedAt: '2024-01-15T10:00:00Z',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(updateRule('rule-id-123', updates)).rejects.toThrow(/modified by another user/);
  });

  it('should update multiple fields together', async () => {
    const updates: UpdateRule = {
      keyword: 'NEW KEYWORD',
      matchType: 'regex',
      priority: 25,
      isEnabled: false,
      suggestedPayee: 'Updated Payee',
    };

    const updatedRule = mockRule({
      keyword: 'new keyword',
      match_type: 'regex',
      priority: 25,
      is_enabled: false,
      suggested_payee: 'Updated Payee',
    });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedRule, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateRule('rule-id-123', updates, { skipVersionCheck: true });

    expect(mockQuery.update).toHaveBeenCalledWith({
      keyword: 'new keyword',
      match_type: 'regex',
      priority: 25,
      is_enabled: false,
      suggested_payee: 'Updated Payee',
    });
  });

  it('should handle foreign key violation when updating category', async () => {
    const updates: UpdateRule = {
      targetCategoryId: 'nonexistent-category',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '23503', message: 'Foreign key violation' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(updateRule('rule-id-123', updates, { skipVersionCheck: true })).rejects.toThrow(
      /in use/
    );
  });
});

describe('deleteRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should hard delete rule', async () => {
    const mockQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await deleteRule('rule-id-123');

    expect(supabase.from).toHaveBeenCalledWith('rules');
    expect(mockQuery.delete).toHaveBeenCalled();
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'rule-id-123');
  });

  it('should throw DatabaseError on deletion failure', async () => {
    const mockQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(deleteRule('nonexistent-id')).rejects.toThrow(DatabaseError);
  });

  it('should throw DatabaseError on permission error', async () => {
    const mockQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Permission denied', code: '42501' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(deleteRule('rule-id-123')).rejects.toThrow(/do not have permission/);
  });

  it('should successfully delete rule with high priority', async () => {
    const mockQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await deleteRule('high-priority-rule');

    expect(mockQuery.delete).toHaveBeenCalled();
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'high-priority-rule');
  });

  it('should successfully delete disabled rule', async () => {
    const mockQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await deleteRule('disabled-rule');

    expect(mockQuery.delete).toHaveBeenCalled();
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'disabled-rule');
  });
});
