import { supabase } from './config';
import { AccessGrant, GrantAccessResult } from '../../types/access';
import { handleSupabaseError, DatabaseError } from '../errors';

export async function grantAccessByEmail(
  booksetId: string,
  email: string,
  role: 'viewer' | 'editor'
): Promise<GrantAccessResult> {
  try {
    const { data, error } = await supabase.rpc('grant_access_by_email', {
      _bookset_id: booksetId,
      _email: email,
      _role: role,
    });

    if (error) {
      // The new RPC function throws an exception if user is not found.
      // We catch this specific error to maintain API compatibility with the UI.
      if (error.message && error.message.includes('not found')) {
        return { success: false, message: 'User not found' };
      }
      handleSupabaseError(error);
    }

    // The new RPC function returns a UUID (string) on success.
    // We map this to the expected GrantAccessResult format.
    return {
      success: true,
      grantId: data as unknown as string,
    };
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to grant access', undefined, error);
  }
}

export async function listAccessGrants(booksetId: string): Promise<AccessGrant[]> {
  try {
    const { data, error } = await supabase
      .from('access_grants')
      .select('*')
      .eq('bookset_id', booksetId)
      .is('revoked_at', null);

    if (error) {
      handleSupabaseError(error);
    }

    // Map snake_case DB fields to camelCase TS interface
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({
      id: row.id,
      booksetId: row.bookset_id,
      userId: row.user_id,
      grantedBy: row.granted_by,
      role: row.role,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
    }));
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to list access grants', undefined, error);
  }
}

export async function revokeAccess(grantId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('access_grants')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq('id', grantId);

    if (error) {
      handleSupabaseError(error);
    }
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to revoke access', undefined, error);
  }
}
