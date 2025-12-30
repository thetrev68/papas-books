/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkUpdateReviewed,
} from './transactions';
import { supabase } from './config';
import { DatabaseError } from '../errors';
import { mockTransaction, mockSplitTransaction } from '../../test-utils/fixtures';

// Mock the Supabase client
vi.mock('./config', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock crypto.subtle for fingerprint generation
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn(async () => {
        // Return a mock hash buffer (32 bytes for SHA-256)
        return new Uint8Array(32).fill(255);
      }),
    },
  },
  writable: true,
});

// Mock validation
vi.mock('../validation/splits', () => ({
  validateSplitLines: vi.fn(() => Promise.resolve({ valid: true, errors: [] })),
}));

describe('fetchTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch transactions for a bookset', async () => {
    const mockData = [mockTransaction(), mockTransaction({ id: 'transaction-2' })];

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchTransactions('test-bookset-id');

    expect(supabase.from).toHaveBeenCalledWith('transactions');
    expect(mockQuery.select).toHaveBeenCalledWith('*');
    expect(mockQuery.eq).toHaveBeenCalledWith('bookset_id', 'test-bookset-id');
    expect(mockQuery.order).toHaveBeenCalledWith('date', { ascending: false });
    expect(result).toEqual(mockData);
  });

  it('should return empty array when no transactions found', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchTransactions('test-bookset-id');

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

    await expect(fetchTransactions('test-bookset-id')).rejects.toThrow(DatabaseError);
  });
});

describe('createTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new transaction with fingerprint', async () => {
    const newTransaction = mockTransaction({ id: undefined as any });
    const createdTransaction = mockTransaction();

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdTransaction, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await createTransaction(newTransaction);

    expect(supabase.from).toHaveBeenCalledWith('transactions');
    expect(mockQuery.insert).toHaveBeenCalled();
    const insertedData = (mockQuery.insert as any).mock.calls[0][0];
    expect(insertedData).toHaveProperty('fingerprint');
    expect(insertedData.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(result).toEqual(createdTransaction);
  });

  it('should throw DatabaseError on creation failure', async () => {
    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Unique constraint violation', code: '23505' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(createTransaction(mockTransaction())).rejects.toThrow(DatabaseError);
  });
});

describe('updateTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update transaction with optimistic locking', async () => {
    const transaction = mockTransaction({
      updated_at: '2024-01-15T10:00:00Z',
      payee: 'Updated Payee',
    });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: transaction, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await updateTransaction(transaction);

    expect(mockQuery.update).toHaveBeenCalledWith({
      payee: transaction.payee,
      payee_id: transaction.payee_id,
      is_reviewed: transaction.is_reviewed,
      is_split: transaction.is_split,
      lines: transaction.lines,
    });
    expect(mockQuery.eq).toHaveBeenCalledWith('id', transaction.id);
    expect(mockQuery.eq).toHaveBeenCalledWith('updated_at', transaction.updated_at);
    expect(result).toEqual(transaction);
  });

  it('should skip version check when option is set', async () => {
    const transaction = mockTransaction();

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: transaction, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateTransaction(transaction, { skipVersionCheck: true });

    // Should only have one eq call (for id), not two (id + updated_at)
    expect(mockQuery.eq).toHaveBeenCalledTimes(1);
    expect(mockQuery.eq).toHaveBeenCalledWith('id', transaction.id);
  });

  it('should throw CONCURRENT_EDIT error when version conflict occurs', async () => {
    const transaction = mockTransaction({ updated_at: '2024-01-15T10:00:00Z' });

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

    await expect(updateTransaction(transaction)).rejects.toThrow(DatabaseError);
    await expect(updateTransaction(transaction)).rejects.toThrow(/modified by another user/);
  });

  it('should throw CONCURRENT_EDIT when no data returned', async () => {
    const transaction = mockTransaction();

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(updateTransaction(transaction)).rejects.toThrow(/modified by another user/);
  });

  it('should validate split lines for split transactions', async () => {
    const splitTransaction = mockSplitTransaction();

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: splitTransaction, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const { validateSplitLines } = await import('../validation/splits');

    await updateTransaction(splitTransaction);

    expect(validateSplitLines).toHaveBeenCalledWith(
      splitTransaction.lines,
      splitTransaction.bookset_id
    );
  });
});

describe('deleteTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should soft delete transaction by setting is_archived', async () => {
    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await deleteTransaction('transaction-id-123');

    expect(mockQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_archived: true,
      })
    );
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'transaction-id-123');
  });

  it('should throw DatabaseError on deletion failure', async () => {
    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(deleteTransaction('nonexistent-id')).rejects.toThrow(DatabaseError);
  });
});

describe('bulkUpdateReviewed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update is_reviewed for multiple transactions', async () => {
    const transactionIds = ['id-1', 'id-2', 'id-3'];

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await bulkUpdateReviewed(transactionIds, true);

    expect(mockQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_reviewed: true,
      })
    );
    expect(mockQuery.in).toHaveBeenCalledWith('id', transactionIds);
  });

  it('should set is_reviewed to false', async () => {
    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await bulkUpdateReviewed(['id-1'], false);

    expect(mockQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_reviewed: false,
      })
    );
  });

  it('should throw DatabaseError on bulk update failure', async () => {
    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Permission denied', code: '42501' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(bulkUpdateReviewed(['id-1'], true)).rejects.toThrow(DatabaseError);
  });
});
