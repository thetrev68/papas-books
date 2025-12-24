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
      handleSupabaseError(error);
    }

    // data is already in the shape of { success: boolean, grantId?: string, message?: string }
    // but typed as any/jsonb return from RPC.
    return data as GrantAccessResult;
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
