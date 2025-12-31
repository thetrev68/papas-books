import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectExactDuplicates, validateImportDates } from './reconciler';
import type { StagedTransaction } from './mapper';
import * as taxYearLocks from '../supabase/taxYearLocks';

// Mock the taxYearLocks module
vi.mock('../supabase/taxYearLocks', () => ({
  isDateLocked: vi.fn(),
}));

describe('detectExactDuplicates', () => {
  it('should mark transaction as duplicate if fingerprint exists', () => {
    const incoming = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 0,
        fingerprint: 'abc123',
      },
    ];

    const existing = new Map([['abc123', 'txn-id-123']]);

    const result = detectExactDuplicates(incoming, existing);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('duplicate');
    expect(result[0].duplicateOfId).toBe('txn-id-123');
  });

  it('should mark transaction as new if fingerprint is unique', () => {
    const incoming = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 0,
        fingerprint: 'abc123',
      },
    ];

    const existing = new Map();

    const result = detectExactDuplicates(incoming, existing);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('new');
    expect(result[0].duplicateOfId).toBeUndefined();
  });

  it('should handle multiple transactions', () => {
    const incoming = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 0,
        fingerprint: 'abc123', // Duplicate
      },
      {
        date: '2024-01-16',
        amount: 20000,
        description: 'Walmart',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 1,
        fingerprint: 'def456', // New
      },
      {
        date: '2024-01-17',
        amount: 30000,
        description: 'Amazon',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 2,
        fingerprint: 'ghi789', // Duplicate
      },
    ];

    const existing = new Map([
      ['abc123', 'txn-id-1'],
      ['ghi789', 'txn-id-3'],
    ]);

    const result = detectExactDuplicates(incoming, existing);

    expect(result).toHaveLength(3);
    expect(result[0].status).toBe('duplicate');
    expect(result[0].duplicateOfId).toBe('txn-id-1');
    expect(result[1].status).toBe('new');
    expect(result[1].duplicateOfId).toBeUndefined();
    expect(result[2].status).toBe('duplicate');
    expect(result[2].duplicateOfId).toBe('txn-id-3');
  });

  it('should preserve original transaction properties', () => {
    const incoming = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: { original: 'data' },
        rowIndex: 5,
        fingerprint: 'abc123',
      },
    ];

    const existing = new Map();

    const result = detectExactDuplicates(incoming, existing);

    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].amount).toBe(10000);
    expect(result[0].description).toBe('Target');
    expect(result[0].fingerprint).toBe('abc123');
    expect(result[0].rawRow).toEqual({ original: 'data' });
    expect(result[0].rowIndex).toBe(5);
  });

  it('should handle empty incoming array', () => {
    const incoming: (StagedTransaction & { fingerprint: string })[] = [];
    const existing = new Map([['abc123', 'txn-id-1']]);

    const result = detectExactDuplicates(incoming, existing);

    expect(result).toHaveLength(0);
  });

  it('should handle empty existing map', () => {
    const incoming = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 0,
        fingerprint: 'abc123',
      },
    ];

    const existing = new Map();

    const result = detectExactDuplicates(incoming, existing);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('new');
  });
});

describe('validateImportDates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return valid when no dates are locked', async () => {
    vi.spyOn(taxYearLocks, 'isDateLocked').mockResolvedValue(false);

    const transactions = [{ date: '2024-01-15' }, { date: '2024-02-20' }, { date: '2024-03-10' }];

    const result = await validateImportDates('test-bookset-id', transactions);

    expect(result.valid).toBe(true);
    expect(result.lockedDates).toEqual([]);
    expect(taxYearLocks.isDateLocked).toHaveBeenCalledTimes(3);
  });

  it('should return invalid with locked dates when some dates are locked', async () => {
    vi.spyOn(taxYearLocks, 'isDateLocked')
      .mockResolvedValueOnce(false) // 2024-01-15
      .mockResolvedValueOnce(true) // 2023-12-20 - locked
      .mockResolvedValueOnce(true); // 2023-11-10 - locked

    const transactions = [{ date: '2024-01-15' }, { date: '2023-12-20' }, { date: '2023-11-10' }];

    const result = await validateImportDates('test-bookset-id', transactions);

    expect(result.valid).toBe(false);
    expect(result.lockedDates).toEqual(['2023-12-20', '2023-11-10']);
    expect(taxYearLocks.isDateLocked).toHaveBeenCalledTimes(3);
  });

  it('should skip transactions without dates', async () => {
    vi.spyOn(taxYearLocks, 'isDateLocked').mockResolvedValue(false);

    const transactions = [{ date: '2024-01-15' }, { date: undefined }, { date: '2024-03-10' }, {}];

    const result = await validateImportDates('test-bookset-id', transactions);

    expect(result.valid).toBe(true);
    expect(result.lockedDates).toEqual([]);
    expect(taxYearLocks.isDateLocked).toHaveBeenCalledTimes(2); // Only called for dates that exist
  });

  it('should handle empty transactions array', async () => {
    vi.spyOn(taxYearLocks, 'isDateLocked').mockResolvedValue(false);

    const transactions: { date?: string }[] = [];

    const result = await validateImportDates('test-bookset-id', transactions);

    expect(result.valid).toBe(true);
    expect(result.lockedDates).toEqual([]);
    expect(taxYearLocks.isDateLocked).not.toHaveBeenCalled();
  });

  it('should handle all dates being locked', async () => {
    vi.spyOn(taxYearLocks, 'isDateLocked').mockResolvedValue(true);

    const transactions = [{ date: '2023-01-15' }, { date: '2023-02-20' }, { date: '2023-03-10' }];

    const result = await validateImportDates('test-bookset-id', transactions);

    expect(result.valid).toBe(false);
    expect(result.lockedDates).toEqual(['2023-01-15', '2023-02-20', '2023-03-10']);
    expect(taxYearLocks.isDateLocked).toHaveBeenCalledTimes(3);
  });

  it('should call isDateLocked with correct parameters', async () => {
    const isDateLockedSpy = vi.spyOn(taxYearLocks, 'isDateLocked').mockResolvedValue(false);

    const transactions = [{ date: '2024-05-15' }];

    await validateImportDates('bookset-123', transactions);

    expect(isDateLockedSpy).toHaveBeenCalledWith('bookset-123', '2024-05-15');
  });
});
