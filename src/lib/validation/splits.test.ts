import { validateSplitLines } from './splits';
import { supabase } from '../supabase/config';
import type { SplitLine } from '../../types/database';

// Mock Supabase
vi.mock('../supabase/config', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('validation/splits', () => {
  const mockCategories = [{ id: 'cat1' }, { id: 'cat2' }, { id: 'cat3' }];

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock response
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockCategories,
            error: null,
          }),
        }),
      }),
    });
  });

  describe('validateSplitLines', () => {
    it('validates valid split lines', async () => {
      const lines: SplitLine[] = [
        { category_id: 'cat1', amount: 5000, memo: 'First split' },
        { category_id: 'cat2', amount: 3000, memo: 'Second split' },
      ];

      const result = await validateSplitLines(lines, 'bookset1');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects empty split lines array', async () => {
      const result = await validateSplitLines([], 'bookset1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one split line is required');
    });

    it('rejects split line without category', async () => {
      const lines: SplitLine[] = [{ category_id: '', amount: 5000, memo: 'Missing category' }];

      const result = await validateSplitLines(lines, 'bookset1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Split line 1: Category is required');
    });

    it('rejects split line with invalid category', async () => {
      const lines: SplitLine[] = [
        { category_id: 'invalid-cat', amount: 5000, memo: 'Invalid category' },
      ];

      const result = await validateSplitLines(lines, 'bookset1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Split line 1: Category no longer exists');
    });

    it('rejects split line with zero amount', async () => {
      const lines: SplitLine[] = [{ category_id: 'cat1', amount: 0, memo: 'Zero amount' }];

      const result = await validateSplitLines(lines, 'bookset1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Split line 1: Amount cannot be zero');
    });

    it('accepts negative amounts', async () => {
      const lines: SplitLine[] = [{ category_id: 'cat1', amount: -5000, memo: 'Negative amount' }];

      const result = await validateSplitLines(lines, 'bookset1');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects memo longer than max length', async () => {
      const lines: SplitLine[] = [{ category_id: 'cat1', amount: 5000, memo: 'a'.repeat(1001) }];

      const result = await validateSplitLines(lines, 'bookset1');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Memo too long');
    });

    it('accepts split line without memo', async () => {
      const lines: SplitLine[] = [{ category_id: 'cat1', amount: 5000 }];

      const result = await validateSplitLines(lines, 'bookset1');
      expect(result.valid).toBe(true);
    });

    it('validates multiple split lines', async () => {
      const lines: SplitLine[] = [
        { category_id: 'cat1', amount: 5000, memo: 'First' },
        { category_id: 'invalid', amount: 0, memo: 'Second' },
        { category_id: 'cat3', amount: 2000, memo: 'a'.repeat(1001) },
      ];

      const result = await validateSplitLines(lines, 'bookset1');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('Split line 2: Category no longer exists');
      expect(result.errors).toContain('Split line 2: Amount cannot be zero');
      expect(result.errors[2]).toContain('Split line 3: Memo too long');
    });

    it('handles database error when fetching categories', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      });

      const lines: SplitLine[] = [{ category_id: 'cat1', amount: 5000 }];

      const result = await validateSplitLines(lines, 'bookset1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Failed to validate categories');
    });

    it('handles empty categories list', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const lines: SplitLine[] = [{ category_id: 'cat1', amount: 5000 }];

      const result = await validateSplitLines(lines, 'bookset1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Split line 1: Category no longer exists');
    });

    it('validates correct index in error messages', async () => {
      const lines: SplitLine[] = [
        { category_id: 'cat1', amount: 5000 },
        { category_id: 'cat2', amount: 0 },
        { category_id: '', amount: 3000 },
      ];

      const result = await validateSplitLines(lines, 'bookset1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Split line 2: Amount cannot be zero');
      expect(result.errors).toContain('Split line 3: Category is required');
    });
  });
});
