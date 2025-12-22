import { supabase } from './config';
import type { Payee } from '../../types/database';

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
  const { data, error } = await supabase
    .from('payees')
    .select('*')
    .eq('bookset_id', booksetId)
    .order('name');

  if (error) throw error;
  return data || [];
}

/**
 * Create a new payee
 */
export async function createPayee(payee: InsertPayee): Promise<Payee> {
  const { data, error } = await supabase.from('payees').insert(payee).select().single();

  if (error) throw error;
  return data;
}

/**
 * Update payee aliases by adding a new alias
 */
export async function updatePayeeAliases(payeeId: string, newAlias: string): Promise<void> {
  // Use the PostgreSQL function to add alias
  const { error } = await supabase.rpc('add_payee_alias', {
    payee_id: payeeId,
    new_alias: newAlias,
  });

  if (error) throw error;
}

/**
 * Update payee details
 */
export async function updatePayee(payeeId: string, updates: Partial<Payee>): Promise<Payee> {
  const { data, error } = await supabase
    .from('payees')
    .update(updates)
    .eq('id', payeeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a payee
 */
export async function deletePayee(payeeId: string): Promise<void> {
  const { error } = await supabase.from('payees').delete().eq('id', payeeId);

  if (error) throw error;
}
