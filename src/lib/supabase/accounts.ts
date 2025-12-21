import { supabase } from './config';
import type { Account } from '../../types/database';
import type { InsertAccount, UpdateAccount } from '../validation/accounts';

export async function fetchAccounts(booksetId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('bookset_id', booksetId)
    .eq('is_archived', false)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createAccount(account: InsertAccount): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      bookset_id: account.booksetId,
      name: account.name,
      type: account.type,
      opening_balance: account.openingBalance,
      opening_balance_date: account.openingBalanceDate,
      is_archived: false,
      last_reconciled_date: null,
      last_reconciled_balance: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAccount(id: string, updates: UpdateAccount): Promise<Account> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.type !== undefined) dbUpdates.type = updates.type;
  if (updates.openingBalance !== undefined) dbUpdates.opening_balance = updates.openingBalance;
  if (updates.openingBalanceDate !== undefined)
    dbUpdates.opening_balance_date = updates.openingBalanceDate;

  const { data, error } = await supabase
    .from('accounts')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from('accounts').update({ is_archived: true }).eq('id', id);

  if (error) throw error;
}
