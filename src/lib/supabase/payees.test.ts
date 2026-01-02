/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPayees, createPayee, updatePayee, deletePayee } from './payees';
import { supabase } from './config';
import { DatabaseError } from '../errors';
import type { InsertPayee } from './payees';
import type { Payee } from '../../types/database';

// Mock the Supabase client
vi.mock('./config', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const mockPayee = (overrides?: Partial<Payee>): Payee => ({
  id: 'payee-1',
  bookset_id: 'test-bookset-id',
  name: 'Test Payee',
  default_category_id: 'cat-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  created_by: 'user-1',
  last_modified_by: 'user-1',
  ...overrides,
});

describe('fetchPayees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch payees for a bookset', async () => {
    const mockData = [mockPayee(), mockPayee({ id: 'payee-2', name: 'Another Payee' })];

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchPayees('test-bookset-id');

    expect(supabase.from).toHaveBeenCalledWith('payees');
    expect(mockQuery.select).toHaveBeenCalledWith('*');
    expect(mockQuery.eq).toHaveBeenCalledWith('bookset_id', 'test-bookset-id');
    expect(mockQuery.order).toHaveBeenCalledWith('name');
    expect(result).toEqual(mockData);
  });

  it('should return empty array when no payees found', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchPayees('test-bookset-id');

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

    await expect(fetchPayees('test-bookset-id')).rejects.toThrow(DatabaseError);
  });

  it('should wrap unknown errors as DatabaseError', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockRejectedValue(new Error('Unknown error')),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(fetchPayees('test-bookset-id')).rejects.toThrow(DatabaseError);
    await expect(fetchPayees('test-bookset-id')).rejects.toThrow('Failed to fetch payees');
  });
});

describe('createPayee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new payee', async () => {
    const newPayee: InsertPayee = {
      bookset_id: 'test-bookset-id',
      name: 'New Payee',
      default_category_id: 'cat-1',
    };

    const createdPayee = mockPayee(newPayee);

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdPayee, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await createPayee(newPayee);

    expect(supabase.from).toHaveBeenCalledWith('payees');
    expect(mockQuery.insert).toHaveBeenCalledWith(newPayee);
    expect(mockQuery.select).toHaveBeenCalled();
    expect(mockQuery.single).toHaveBeenCalled();
    expect(result).toEqual(createdPayee);
  });

  it('should create payee without default category', async () => {
    const newPayee: InsertPayee = {
      bookset_id: 'test-bookset-id',
      name: 'New Payee',
    };

    const createdPayee = mockPayee({ ...newPayee, default_category_id: null });

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdPayee, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await createPayee(newPayee);

    expect(result.default_category_id).toBeNull();
  });

  it('should throw DatabaseError on creation failure', async () => {
    const newPayee: InsertPayee = {
      bookset_id: 'test-bookset-id',
      name: 'Duplicate Payee',
    };

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Duplicate name', code: '23505' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(createPayee(newPayee)).rejects.toThrow(DatabaseError);
  });

  it('should wrap unknown errors as DatabaseError', async () => {
    const newPayee: InsertPayee = {
      bookset_id: 'test-bookset-id',
      name: 'Test Payee',
    };

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockRejectedValue(new Error('Network error')),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(createPayee(newPayee)).rejects.toThrow(DatabaseError);
    await expect(createPayee(newPayee)).rejects.toThrow('Failed to create payee');
  });
});

describe('updatePayee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update payee name', async () => {
    const payeeId = 'payee-1';
    const updates = { name: 'Updated Payee' };
    const updatedPayee = mockPayee({ id: payeeId, name: 'Updated Payee' });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedPayee, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await updatePayee(payeeId, updates);

    expect(supabase.from).toHaveBeenCalledWith('payees');
    expect(mockQuery.update).toHaveBeenCalledWith(updates);
    expect(mockQuery.eq).toHaveBeenCalledWith('id', payeeId);
    expect(mockQuery.select).toHaveBeenCalled();
    expect(mockQuery.single).toHaveBeenCalled();
    expect(result).toEqual(updatedPayee);
  });

  it('should update payee default category', async () => {
    const payeeId = 'payee-1';
    const updates = { default_category_id: 'cat-2' };
    const updatedPayee = mockPayee({ id: payeeId, default_category_id: 'cat-2' });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedPayee, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await updatePayee(payeeId, updates);

    expect(result.default_category_id).toBe('cat-2');
  });

  it('should update multiple fields', async () => {
    const payeeId = 'payee-1';
    const updates = { name: 'New Name', default_category_id: 'cat-3' };
    const updatedPayee = mockPayee({ id: payeeId, ...updates });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedPayee, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await updatePayee(payeeId, updates);

    expect(result.name).toBe('New Name');
    expect(result.default_category_id).toBe('cat-3');
  });

  it('should throw DatabaseError on update failure', async () => {
    const payeeId = 'payee-1';
    const updates = { name: 'Updated' };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found', code: '404' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(updatePayee(payeeId, updates)).rejects.toThrow(DatabaseError);
  });

  it('should wrap unknown errors as DatabaseError', async () => {
    const payeeId = 'payee-1';
    const updates = { name: 'Updated' };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockRejectedValue(new Error('Connection lost')),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(updatePayee(payeeId, updates)).rejects.toThrow(DatabaseError);
    await expect(updatePayee(payeeId, updates)).rejects.toThrow('Failed to update payee');
  });
});

describe('deletePayee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a payee', async () => {
    const payeeId = 'payee-1';

    const mockQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await deletePayee(payeeId);

    expect(supabase.from).toHaveBeenCalledWith('payees');
    expect(mockQuery.delete).toHaveBeenCalled();
    expect(mockQuery.eq).toHaveBeenCalledWith('id', payeeId);
  });

  it('should throw DatabaseError on delete failure', async () => {
    const payeeId = 'payee-1';

    const mockQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        error: { message: 'Foreign key violation', code: '23503' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(deletePayee(payeeId)).rejects.toThrow(DatabaseError);
  });

  it('should wrap unknown errors as DatabaseError', async () => {
    const payeeId = 'payee-1';

    const mockQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockRejectedValue(new Error('Timeout')),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(deletePayee(payeeId)).rejects.toThrow(DatabaseError);
    await expect(deletePayee(payeeId)).rejects.toThrow('Failed to delete payee');
  });
});
