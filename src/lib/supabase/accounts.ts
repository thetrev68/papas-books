import { supabase } from './config';
import type { Account } from '../../types/database';
import type { InsertAccount, UpdateAccount } from '../validation/accounts';

export async function fetchAccounts(booksetId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('booksetId', booksetId)
    .eq('isArchived', false)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createAccount(account: InsertAccount): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      booksetId: account.booksetId,
      name: account.name,
      type: account.type,
      openingBalance: account.openingBalance,
      openingBalanceDate: account.openingBalanceDate,
      isArchived: false,
      lastReconciledDate: null,
      lastReconciledBalance: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAccount(id: string, updates: UpdateAccount): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from('accounts').update({ isArchived: true }).eq('id', id);

  if (error) throw error;
}
