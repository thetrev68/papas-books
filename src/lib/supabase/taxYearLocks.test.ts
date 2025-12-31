/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchTaxYearLocks,
  lockTaxYear,
  unlockTaxYear,
  getMaxLockedYear,
  isDateLocked,
} from './taxYearLocks';
import { supabase } from './config';

// Mock the Supabase client
vi.mock('./config', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('fetchTaxYearLocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch locked years for a bookset', async () => {
    const mockData = [{ tax_year: 2022 }, { tax_year: 2023 }];

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchTaxYearLocks('test-bookset-id');

    expect(supabase.from).toHaveBeenCalledWith('tax_year_locks');
    expect(mockQuery.select).toHaveBeenCalledWith('tax_year');
    expect(mockQuery.eq).toHaveBeenCalledWith('bookset_id', 'test-bookset-id');
    expect(mockQuery.order).toHaveBeenCalledWith('tax_year', { ascending: true });
    expect(result).toEqual([2022, 2023]);
  });

  it('should return empty array when no locked years found', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchTaxYearLocks('test-bookset-id');

    expect(result).toEqual([]);
  });

  it('should return empty array when table does not exist (42P01 error)', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchTaxYearLocks('test-bookset-id');

    expect(result).toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Tax year locks table missing or inaccessible. Feature disabled.'
    );

    consoleWarnSpy.mockRestore();
  });

  it('should return empty array when table is not accessible (404 message)', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'SOME_ERROR', message: 'Not found: 404' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const result = await fetchTaxYearLocks('test-bookset-id');

    expect(result).toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Tax year locks table missing or inaccessible. Feature disabled.'
    );

    consoleWarnSpy.mockRestore();
  });

  it('should throw error on other Supabase errors', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: '42501' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    await expect(fetchTaxYearLocks('test-bookset-id')).rejects.toThrow();
  });
});

describe('lockTaxYear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should lock a tax year successfully', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await lockTaxYear('test-bookset-id', 2023);

    expect(supabase.rpc).toHaveBeenCalledWith('lock_tax_year', {
      p_bookset_id: 'test-bookset-id',
      p_year: 2023,
    });
  });

  it('should throw error on lock failure', async () => {
    const mockError = { message: 'Failed to lock year', code: '23505' };
    (supabase.rpc as any).mockResolvedValue({ data: null, error: mockError });

    await expect(lockTaxYear('test-bookset-id', 2023)).rejects.toThrow();
  });
});

describe('unlockTaxYear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should unlock a tax year successfully', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    await unlockTaxYear('test-bookset-id', 2023);

    expect(supabase.rpc).toHaveBeenCalledWith('unlock_tax_year', {
      p_bookset_id: 'test-bookset-id',
      p_year: 2023,
    });
  });

  it('should throw error on unlock failure', async () => {
    const mockError = { message: 'Failed to unlock year', code: '23503' };
    (supabase.rpc as any).mockResolvedValue({ data: null, error: mockError });

    await expect(unlockTaxYear('test-bookset-id', 2023)).rejects.toThrow();
  });
});

describe('getMaxLockedYear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the maximum locked year', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: 2023, error: null });

    const result = await getMaxLockedYear('test-bookset-id');

    expect(supabase.rpc).toHaveBeenCalledWith('get_max_locked_year', {
      p_bookset_id: 'test-bookset-id',
    });
    expect(result).toBe(2023);
  });

  it('should return null when no years are locked', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    const result = await getMaxLockedYear('test-bookset-id');

    expect(result).toBeNull();
  });

  it('should throw error on RPC failure', async () => {
    const mockError = { message: 'RPC failed', code: '42883' };
    (supabase.rpc as any).mockResolvedValue({ data: null, error: mockError });

    await expect(getMaxLockedYear('test-bookset-id')).rejects.toThrow();
  });
});

describe('isDateLocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when date is locked', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: true, error: null });

    const result = await isDateLocked('test-bookset-id', '2023-05-15');

    expect(supabase.rpc).toHaveBeenCalledWith('is_date_locked', {
      p_bookset_id: 'test-bookset-id',
      p_date: '2023-05-15',
    });
    expect(result).toBe(true);
  });

  it('should return false when date is not locked', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: false, error: null });

    const result = await isDateLocked('test-bookset-id', '2024-05-15');

    expect(result).toBe(false);
  });

  it('should return false when data is null', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

    const result = await isDateLocked('test-bookset-id', '2024-05-15');

    expect(result).toBe(false);
  });

  it('should return false when RPC does not exist (42883 error)', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { code: '42883', message: 'function does not exist' },
    });

    const result = await isDateLocked('test-bookset-id', '2023-05-15');

    expect(result).toBe(false);
  });

  it('should return false when RPC is not accessible (404 message)', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { code: 'SOME_ERROR', message: 'Not found: 404' },
    });

    const result = await isDateLocked('test-bookset-id', '2023-05-15');

    expect(result).toBe(false);
  });

  it('should throw error on other RPC failures', async () => {
    const mockError = { message: 'Database error', code: '42501' };
    (supabase.rpc as any).mockResolvedValue({ data: null, error: mockError });

    await expect(isDateLocked('test-bookset-id', '2023-05-15')).rejects.toThrow();
  });
});
