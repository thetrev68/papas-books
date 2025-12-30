/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  updateAccountMapping,
} from './accounts';
import { supabase } from './config';
import { DatabaseError } from '../errors';
import { mockAccount } from '../../test-utils/fixtures';
import type { InsertAccount, UpdateAccount } from '../validation/accounts';
import type { CsvMapping } from '../../types/import';

// Mock the Supabase client
vi.mock('./config', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('fetchAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch accounts for a bookset', async () => {
    const mockData = [mockAccount(), mockAccount({ id: 'account-2', name: 'Savings Account' })];

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchAccounts('test-bookset-id');

    expect(supabase.from).toHaveBeenCalledWith('accounts');
    expect(mockQuery.select).toHaveBeenCalledWith('*');
    expect(mockQuery.eq).toHaveBeenCalledWith('bookset_id', 'test-bookset-id');
    expect(mockQuery.eq).toHaveBeenCalledWith('is_archived', false);
    expect(mockQuery.order).toHaveBeenCalledWith('name', { ascending: true });
    expect(result).toEqual(mockData);
  });

  it('should return empty array when no accounts found', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchAccounts('test-bookset-id');

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

    await expect(fetchAccounts('test-bookset-id')).rejects.toThrow(DatabaseError);
  });

  it('should throw DatabaseError with permission message on RLS violation', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'RLS violation', code: '42501' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(fetchAccounts('test-bookset-id')).rejects.toThrow(/do not have permission/);
  });
});

describe('createAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new account with opening balance', async () => {
    const newAccount: InsertAccount = {
      booksetId: 'test-bookset-id',
      name: 'New Checking Account',
      type: 'Asset',
      openingBalance: 50000, // $500.00
      openingBalanceDate: '2024-01-01',
    };

    const createdAccount = mockAccount({
      name: newAccount.name,
      type: newAccount.type,
      opening_balance: newAccount.openingBalance,
      opening_balance_date: newAccount.openingBalanceDate,
    });

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdAccount, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await createAccount(newAccount);

    expect(supabase.from).toHaveBeenCalledWith('accounts');
    expect(mockQuery.insert).toHaveBeenCalledWith({
      bookset_id: newAccount.booksetId,
      name: newAccount.name,
      type: newAccount.type,
      opening_balance: newAccount.openingBalance,
      opening_balance_date: newAccount.openingBalanceDate,
      is_archived: false,
      last_reconciled_date: null,
      last_reconciled_balance: 0,
    });
    expect(result).toEqual(createdAccount);
  });

  it('should create account with liability type', async () => {
    const newAccount: InsertAccount = {
      booksetId: 'test-bookset-id',
      name: 'Credit Card',
      type: 'Liability',
      openingBalance: -10000, // -$100.00 (credit card debt)
      openingBalanceDate: '2024-01-01',
    };

    const createdAccount = mockAccount({
      type: 'Liability',
      opening_balance: -10000,
    });

    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdAccount, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await createAccount(newAccount);

    expect(mockQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Liability',
        opening_balance: -10000,
      })
    );
    expect(result).toEqual(createdAccount);
  });

  it('should throw DatabaseError on creation failure', async () => {
    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Duplicate name', code: '23505' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const newAccount: InsertAccount = {
      booksetId: 'test-bookset-id',
      name: 'Duplicate Account',
      type: 'Asset',
      openingBalance: 0,
      openingBalanceDate: '2024-01-01',
    };

    await expect(createAccount(newAccount)).rejects.toThrow(DatabaseError);
  });

  it('should throw DatabaseError with duplicate message on unique violation', async () => {
    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Unique violation', code: '23505' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const newAccount: InsertAccount = {
      booksetId: 'test-bookset-id',
      name: 'Duplicate',
      type: 'Asset',
      openingBalance: 0,
      openingBalanceDate: '2024-01-01',
    };

    await expect(createAccount(newAccount)).rejects.toThrow(/already exists/);
  });
});

describe('updateAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update account with optimistic locking', async () => {
    const updates: UpdateAccount = {
      name: 'Updated Account Name',
      type: 'Asset',
      openingBalance: 75000,
      openingBalanceDate: '2024-02-01',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    const updatedAccount = mockAccount({
      name: updates.name,
      opening_balance: updates.openingBalance,
      updated_at: '2024-01-15T10:30:00Z',
    });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedAccount, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await updateAccount('account-id-123', updates);

    expect(mockQuery.update).toHaveBeenCalledWith({
      name: updates.name,
      type: updates.type,
      opening_balance: updates.openingBalance,
      opening_balance_date: updates.openingBalanceDate,
    });
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'account-id-123');
    expect(mockQuery.eq).toHaveBeenCalledWith('updated_at', updates.updatedAt);
    expect(result).toEqual(updatedAccount);
  });

  it('should skip version check when option is set', async () => {
    const updates: UpdateAccount = {
      name: 'Updated Name',
    };

    const updatedAccount = mockAccount({ name: 'Updated Name' });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedAccount, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateAccount('account-id-123', updates, { skipVersionCheck: true });

    // Should only have one eq call (for id), not two (id + updated_at)
    expect(mockQuery.eq).toHaveBeenCalledTimes(1);
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'account-id-123');
  });

  it('should update only name when other fields are undefined', async () => {
    const updates: UpdateAccount = {
      name: 'Just Name Update',
    };

    const updatedAccount = mockAccount({ name: 'Just Name Update' });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedAccount, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateAccount('account-id-123', updates, { skipVersionCheck: true });

    expect(mockQuery.update).toHaveBeenCalledWith({ name: 'Just Name Update' });
  });

  it('should throw CONCURRENT_EDIT error when version conflict occurs', async () => {
    const updates: UpdateAccount = {
      name: 'Updated',
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

    await expect(updateAccount('account-id-123', updates)).rejects.toThrow(DatabaseError);
    await expect(updateAccount('account-id-123', updates)).rejects.toThrow(
      /modified by another user/
    );
  });

  it('should throw CONCURRENT_EDIT when no data returned', async () => {
    const updates: UpdateAccount = {
      name: 'Updated',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(updateAccount('account-id-123', updates)).rejects.toThrow(
      /modified by another user/
    );
  });

  it('should update opening balance and date together', async () => {
    const updates: UpdateAccount = {
      openingBalance: 100000,
      openingBalanceDate: '2024-03-01',
    };

    const updatedAccount = mockAccount({
      opening_balance: 100000,
      opening_balance_date: '2024-03-01',
    });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedAccount, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateAccount('account-id-123', updates, { skipVersionCheck: true });

    expect(mockQuery.update).toHaveBeenCalledWith({
      opening_balance: 100000,
      opening_balance_date: '2024-03-01',
    });
  });

  it('should handle foreign key violation error', async () => {
    const updates: UpdateAccount = {
      name: 'Updated',
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

    await expect(updateAccount('account-id-123', updates)).rejects.toThrow(/in use/);
  });
});

describe('deleteAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should soft delete account by setting is_archived', async () => {
    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await deleteAccount('account-id-123');

    expect(supabase.from).toHaveBeenCalledWith('accounts');
    expect(mockQuery.update).toHaveBeenCalledWith({ is_archived: true });
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'account-id-123');
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

    await expect(deleteAccount('nonexistent-id')).rejects.toThrow(DatabaseError);
  });

  it('should throw DatabaseError on permission error', async () => {
    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Permission denied', code: '42501' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(deleteAccount('account-id-123')).rejects.toThrow(/do not have permission/);
  });
});

describe('updateAccountMapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update CSV mapping configuration', async () => {
    const mapping: CsvMapping = {
      dateColumn: 'Transaction Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Merchant',
      dateFormat: 'MM/dd/yyyy',
      hasHeaderRow: true,
      amountMode: 'signed',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateAccountMapping('account-id-123', mapping);

    expect(supabase.from).toHaveBeenCalledWith('accounts');
    expect(mockQuery.update).toHaveBeenCalledWith({ csv_mapping: mapping });
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'account-id-123');
  });

  it('should update mapping with separate inflow/outflow columns', async () => {
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'yyyy-MM-dd',
      hasHeaderRow: true,
      amountMode: 'separate',
      inflowColumn: 'Credit',
      outflowColumn: 'Debit',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateAccountMapping('account-id-123', mapping);

    expect(mockQuery.update).toHaveBeenCalledWith({ csv_mapping: mapping });
  });

  it('should throw DatabaseError on update failure', async () => {
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy',
      hasHeaderRow: true,
      amountMode: 'signed',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed', code: '42501' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(updateAccountMapping('account-id-123', mapping)).rejects.toThrow(DatabaseError);
  });

  it('should handle account not found error', async () => {
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy',
      hasHeaderRow: true,
      amountMode: 'signed',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(updateAccountMapping('nonexistent-id', mapping)).rejects.toThrow(/not found/);
  });

  it('should update mapping to minimal configuration', async () => {
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'yyyy-MM-dd',
      hasHeaderRow: false,
      amountMode: 'signed',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await updateAccountMapping('account-id-123', mapping);

    expect(mockQuery.update).toHaveBeenCalledWith({ csv_mapping: mapping });
  });
});
