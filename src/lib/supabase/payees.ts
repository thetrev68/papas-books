import { supabase } from './config';
import type { Payee } from '../../types/database';
import { handleSupabaseError, DatabaseError } from '../errors';

export interface InsertPayee {
  bookset_id: string;
  name: string;
  aliases?: string[];
  category_id?: string;
}

/**
 * Fetch all payees for a bookset
 */
export async function fetchPayees(booksetId: string): Promise<Payee[]> {
  try {
    const { data, error } = await supabase
      .from('payees')
      .select('*')
      .eq('bookset_id', booksetId)
      .order('name');

    if (error) {
      handleSupabaseError(error);
    }
    return data || [];
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to fetch payees', undefined, error);
  }
}

/**
 * Create a new payee
 */
export async function createPayee(payee: InsertPayee): Promise<Payee> {
  try {
    const { data, error } = await supabase.from('payees').insert(payee).select().single();

    if (error) {
      handleSupabaseError(error);
    }
    return data;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to create payee', undefined, error);
  }
}

/**
 * Update payee details
 */
export async function updatePayee(payeeId: string, updates: Partial<Payee>): Promise<Payee> {
  try {
    const { data, error } = await supabase
      .from('payees')
      .update(updates)
      .eq('id', payeeId)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
    }
    return data;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to update payee', undefined, error);
  }
}

/**
 * Delete a payee
 */
export async function deletePayee(payeeId: string): Promise<void> {
  try {
    const { error } = await supabase.from('payees').delete().eq('id', payeeId);

    if (error) {
      handleSupabaseError(error);
    }
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to delete payee', undefined, error);
  }
}
