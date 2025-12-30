import { DatabaseError, handleSupabaseError } from './errors';

describe('errors', () => {
  describe('DatabaseError', () => {
    it('creates error with message only', () => {
      const error = new DatabaseError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('DatabaseError');
      expect(error.code).toBeUndefined();
      expect(error.originalError).toBeUndefined();
    });

    it('creates error with code', () => {
      const error = new DatabaseError('Test error', '42501');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('42501');
    });

    it('creates error with original error', () => {
      const original = new Error('Original');
      const error = new DatabaseError('Test error', '42501', original);
      expect(error.originalError).toBe(original);
    });

    it('is instanceof Error', () => {
      const error = new DatabaseError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DatabaseError);
    });
  });

  describe('handleSupabaseError', () => {
    it('handles RLS policy violation (42501)', () => {
      const supabaseError = {
        code: '42501',
        message: 'RLS policy violation',
      };

      expect(() => handleSupabaseError(supabaseError)).toThrow(DatabaseError);
      expect(() => handleSupabaseError(supabaseError)).toThrow(
        'You do not have permission to perform this action'
      );

      try {
        handleSupabaseError(supabaseError);
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        expect((error as DatabaseError).code).toBe('42501');
        expect((error as DatabaseError).originalError).toBe(supabaseError);
      }
    });

    it('handles unique violation (23505)', () => {
      const supabaseError = {
        code: '23505',
        message: 'Unique constraint violation',
      };

      expect(() => handleSupabaseError(supabaseError)).toThrow('This record already exists');

      try {
        handleSupabaseError(supabaseError);
      } catch (error) {
        expect((error as DatabaseError).code).toBe('23505');
      }
    });

    it('handles foreign key violation (23503)', () => {
      const supabaseError = {
        code: '23503',
        message: 'Foreign key constraint violation',
      };

      expect(() => handleSupabaseError(supabaseError)).toThrow(
        'Cannot delete this record because it is in use'
      );
    });

    it('handles record not found (PGRST116)', () => {
      const supabaseError = {
        code: 'PGRST116',
        message: 'No rows returned',
      };

      expect(() => handleSupabaseError(supabaseError)).toThrow('Record not found');
    });

    it('handles unknown error codes', () => {
      const supabaseError = {
        code: 'UNKNOWN_CODE',
        message: 'Unknown error',
      };

      expect(() => handleSupabaseError(supabaseError)).toThrow(
        'An unexpected database error occurred. Please try again.'
      );
    });

    it('handles errors without code', () => {
      const error = new Error('Generic error');

      expect(() => handleSupabaseError(error)).toThrow('An unexpected error occurred');

      try {
        handleSupabaseError(error);
      } catch (e) {
        expect((e as DatabaseError).code).toBeUndefined();
        expect((e as DatabaseError).originalError).toBe(error);
      }
    });

    it('handles non-object errors', () => {
      expect(() => handleSupabaseError('string error')).toThrow('An unexpected error occurred');
      expect(() => handleSupabaseError(null)).toThrow('An unexpected error occurred');
      expect(() => handleSupabaseError(undefined)).toThrow('An unexpected error occurred');
      expect(() => handleSupabaseError(42)).toThrow('An unexpected error occurred');
    });

    it('logs error to console', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = { code: '42501', message: 'Test' };

      try {
        handleSupabaseError(error);
      } catch {
        // Expected to throw
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith('Supabase error:', error);
      consoleErrorSpy.mockRestore();
    });
  });
});
