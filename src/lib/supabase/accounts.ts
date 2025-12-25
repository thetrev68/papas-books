import { supabase } from './config';
import type { Account } from '../../types/database';
import type { InsertAccount, UpdateAccount } from '../validation/accounts';
import type { CsvMapping } from '../../types/import';
import { handleSupabaseError, DatabaseError } from '../errors';

export async function fetchAccounts(booksetId: string): Promise<Account[]> {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('bookset_id', booksetId)
      .eq('is_archived', false)
      .order('name', { ascending: true });

    if (error) {
      handleSupabaseError(error);
    }
    return data || [];
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to fetch accounts', undefined, error);
  }
}

export async function createAccount(account: InsertAccount): Promise<Account> {
  try {
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

    if (error) {
      handleSupabaseError(error);
    }
    return data;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to create account', undefined, error);
  }
}

export async function updateAccount(
  id: string,
  updates: UpdateAccount,
  options?: { skipVersionCheck?: boolean }
): Promise<Account> {
  try {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.openingBalance !== undefined) dbUpdates.opening_balance = updates.openingBalance;
    if (updates.openingBalanceDate !== undefined)
      dbUpdates.opening_balance_date = updates.openingBalanceDate;

    let query = supabase.from('accounts').update(dbUpdates).eq('id', id);

    // Optimistic locking: only update if updated_at hasn't changed
    if (!options?.skipVersionCheck && updates.updatedAt) {
      query = query.eq('updated_at', updates.updatedAt);
    }

    const { data, error } = await query.select().single();

    if (error) {
      // Check if no rows were updated (version conflict)
      if (error.code === 'PGRST116') {
        throw new DatabaseError(
          'This account was modified by another user. Please reload and try again.',
          'CONCURRENT_EDIT',
          error
        );
      }
      handleSupabaseError(error);
    }

    if (!data) {
      throw new DatabaseError(
        'This account was modified by another user. Please reload and try again.',
        'CONCURRENT_EDIT'
      );
    }

    return data;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to update account', undefined, error);
  }
}

export async function deleteAccount(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('accounts').update({ is_archived: true }).eq('id', id);

    if (error) {
      handleSupabaseError(error);
    }
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to delete account', undefined, error);
  }
}

/**
 * Updates the CSV mapping configuration for an account.
 *
 * @param accountId - Account UUID
 * @param mapping - CSV mapping configuration
 */
export async function updateAccountMapping(accountId: string, mapping: CsvMapping): Promise<void> {
  try {
    const { error } = await supabase
      .from('accounts')
      .update({ csv_mapping: mapping })
      .eq('id', accountId);

    if (error) {
      handleSupabaseError(error);
    }
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to update account mapping', undefined, error);
  }
}
