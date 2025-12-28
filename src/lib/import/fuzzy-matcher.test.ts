import { findFuzzyMatches, detectFuzzyDuplicates } from './fuzzy-matcher';
import type { ProcessedTransaction } from './reconciler';
import type { Transaction } from '../../types/database';

describe('findFuzzyMatches', () => {
  it('should find matches within ±3 days with same amount', () => {
    const transaction: ProcessedTransaction = {
      date: '2024-01-15',
      amount: 10000,
      description: 'Target',
      isValid: true,
      errors: [],
      rawRow: {},
      rowIndex: 0,
      fingerprint: 'abc123',
      status: 'new',
    };

    const existing: Partial<Transaction>[] = [
      {
        id: '1',
        date: '2024-01-13',
        amount: 10000,
        description: 'Target Store',
      } as unknown as Transaction, // 2 days before
      {
        id: '2',
        date: '2024-01-17',
        amount: 10000,
        description: 'Target',
      } as unknown as Transaction, // 2 days after
      {
        id: '3',
        date: '2024-01-20',
        amount: 10000,
        description: 'Target',
      } as unknown as Transaction, // 5 days after - too far
      {
        id: '4',
        date: '2024-01-15',
        amount: 20000,
        description: 'Target',
      } as unknown as Transaction, // Same date, different amount
    ];

    const matches = findFuzzyMatches(transaction, existing as Transaction[]);

    expect(matches).toHaveLength(2);
    expect(matches[0].id).toBe('1');
    expect(matches[1].id).toBe('2');
  });

  it('should require exact amount match by default', () => {
    const transaction: ProcessedTransaction = {
      date: '2024-01-15',
      amount: 10000,
      description: 'Target',
      isValid: true,
      errors: [],
      rawRow: {},
      rowIndex: 0,
      fingerprint: 'abc123',
      status: 'new',
    };

    const existing: Partial<Transaction>[] = [
      {
        id: '1',
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
      } as unknown as Transaction,
      {
        id: '2',
        date: '2024-01-15',
        amount: 10001,
        description: 'Target',
      } as unknown as Transaction, // 1 cent off
    ];

    const matches = findFuzzyMatches(transaction, existing as Transaction[]);

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('1');
  });

  it('should respect custom date window', () => {
    const transaction: ProcessedTransaction = {
      date: '2024-01-15',
      amount: 10000,
      description: 'Target',
      isValid: true,
      errors: [],
      rawRow: {},
      rowIndex: 0,
      fingerprint: 'abc123',
      status: 'new',
    };

    const existing: Partial<Transaction>[] = [
      {
        id: '1',
        date: '2024-01-10',
        amount: 10000,
        description: 'Target',
      } as unknown as Transaction, // 5 days before
      {
        id: '2',
        date: '2024-01-14',
        amount: 10000,
        description: 'Target',
      } as unknown as Transaction, // 1 day before
    ];

    const matchesDefault = findFuzzyMatches(transaction, existing as Transaction[]);
    const matchesWide = findFuzzyMatches(transaction, existing as Transaction[], {
      dateWindowDays: 7,
      requireExactAmount: true,
    });

    expect(matchesDefault).toHaveLength(1); // Only within 3 days
    expect(matchesDefault[0].id).toBe('2');

    expect(matchesWide).toHaveLength(2); // Both within 7 days
  });

  it('should return empty array if transaction has no date', () => {
    const transaction: ProcessedTransaction = {
      date: undefined,
      amount: 10000,
      description: 'Target',
      isValid: false,
      errors: ['Invalid date'],
      rawRow: {},
      rowIndex: 0,
      fingerprint: 'abc123',
      status: 'new',
    };

    const existing: Partial<Transaction>[] = [
      {
        id: '1',
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
      } as unknown as Transaction,
    ];

    const matches = findFuzzyMatches(transaction, existing as Transaction[]);

    expect(matches).toHaveLength(0);
  });

  it('should return empty array if transaction has no amount', () => {
    const transaction: ProcessedTransaction = {
      date: '2024-01-15',
      amount: undefined,
      description: 'Target',
      isValid: false,
      errors: ['Invalid amount'],
      rawRow: {},
      rowIndex: 0,
      fingerprint: 'abc123',
      status: 'new',
    };

    const existing: Partial<Transaction>[] = [
      {
        id: '1',
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
      } as unknown as Transaction,
    ];

    const matches = findFuzzyMatches(transaction, existing as Transaction[]);

    expect(matches).toHaveLength(0);
  });

  it('should match on exact date (0 days difference)', () => {
    const transaction: ProcessedTransaction = {
      date: '2024-01-15',
      amount: 10000,
      description: 'Target',
      isValid: true,
      errors: [],
      rawRow: {},
      rowIndex: 0,
      fingerprint: 'abc123',
      status: 'new',
    };

    const existing: Partial<Transaction>[] = [
      {
        id: '1',
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
      } as unknown as Transaction,
    ];

    const matches = findFuzzyMatches(transaction, existing as Transaction[]);

    expect(matches).toHaveLength(1);
  });
});

describe('detectFuzzyDuplicates', () => {
  it('should only check transactions with status "new"', () => {
    const processed: ProcessedTransaction[] = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 0,
        fingerprint: 'abc123',
        status: 'new',
      },
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 1,
        fingerprint: 'def456',
        status: 'duplicate', // Already marked as duplicate
        duplicateOfId: 'txn-id-1',
      },
    ];

    const existing: Partial<Transaction>[] = [
      {
        id: '1',
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
      } as unknown as Transaction,
    ];

    const result = detectFuzzyDuplicates(processed, existing as Transaction[]);

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('fuzzy_duplicate'); // Was "new", now "fuzzy_duplicate"
    expect(result[1].status).toBe('duplicate'); // Still "duplicate"
  });

  it('should mark transactions with fuzzy matches', () => {
    const processed: ProcessedTransaction[] = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 0,
        fingerprint: 'abc123',
        status: 'new',
      },
    ];

    const existing: Partial<Transaction>[] = [
      {
        id: '1',
        date: '2024-01-14',
        amount: 10000,
        description: 'Target',
      } as unknown as Transaction,
    ];

    const result = detectFuzzyDuplicates(processed, existing as Transaction[]);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('fuzzy_duplicate');
    expect(result[0].fuzzyMatches).toHaveLength(1);
    expect(result[0].fuzzyMatches![0].id).toBe('1');
  });

  it('should leave transactions as "new" if no fuzzy matches found', () => {
    const processed: ProcessedTransaction[] = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 0,
        fingerprint: 'abc123',
        status: 'new',
      },
    ];

    const existing: Partial<Transaction>[] = [
      {
        id: '1',
        date: '2024-01-20',
        amount: 10000,
        description: 'Target',
      } as unknown as Transaction, // Too far
    ];

    const result = detectFuzzyDuplicates(processed, existing as Transaction[]);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('new');
    expect(result[0].fuzzyMatches).toBeUndefined();
  });

  it('should handle empty arrays', () => {
    const processed: ProcessedTransaction[] = [];
    const existing: Transaction[] = [];

    const result = detectFuzzyDuplicates(processed, existing);

    expect(result).toHaveLength(0);
  });

  it('should respect custom options', () => {
    const processed: ProcessedTransaction[] = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 0,
        fingerprint: 'abc123',
        status: 'new',
      },
    ];

    const existing: Partial<Transaction>[] = [
      {
        id: '1',
        date: '2024-01-10',
        amount: 10000,
        description: 'Target',
      } as unknown as Transaction, // 5 days before
    ];

    const resultDefault = detectFuzzyDuplicates(processed, existing as Transaction[]);
    const resultWide = detectFuzzyDuplicates(processed, existing as Transaction[], {
      dateWindowDays: 7,
      requireExactAmount: true,
    });

    expect(resultDefault[0].status).toBe('new'); // 5 days is outside default window
    expect(resultWide[0].status).toBe('fuzzy_duplicate'); // 5 days is within 7 day window
  });
});
