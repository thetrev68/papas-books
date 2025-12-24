// src/lib/errors.ts

export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export function handleSupabaseError(error: unknown): never {
  console.error('Supabase error:', error);

  if (error && typeof error === 'object' && 'code' in error) {
    const supabaseError = error as { code: string; message: string };

    switch (supabaseError.code) {
      case '42501': // RLS policy violation
        throw new DatabaseError(
          'You do not have permission to perform this action',
          supabaseError.code,
          error
        );
      case '23505': // Unique violation
        throw new DatabaseError('This record already exists', supabaseError.code, error);
      case '23503': // Foreign key violation
        throw new DatabaseError(
          'Cannot delete this record because it is in use',
          supabaseError.code,
          error
        );
      case 'PGRST116': // No rows returned
        throw new DatabaseError('Record not found', supabaseError.code, error);
      default:
        throw new DatabaseError(
          'An unexpected database error occurred. Please try again.',
          supabaseError.code,
          error
        );
    }
  }

  throw new DatabaseError('An unexpected error occurred', undefined, error);
}
