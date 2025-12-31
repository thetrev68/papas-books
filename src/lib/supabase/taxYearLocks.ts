import { supabase } from './config';
import type { TaxYearLock } from '../../types/database';

/**
 * Fetches all locked years for a bookset
 */
export async function fetchTaxYearLocks(booksetId: string): Promise<TaxYearLock[]> {
  const { data, error } = await supabase
    .from('tax_year_locks')
    .select('*')
    .eq('bookset_id', booksetId)
    .order('tax_year', { ascending: true });

  if (error) {
    // If the table doesn't exist (e.g. migration not applied), return empty list
    // to prevent application crash/spam.
    if (error.code === '42P01' || error.message?.includes('404')) {
      console.warn('Tax year locks table missing or inaccessible. Feature disabled.');
      return [];
    }
    throw error;
  }
  return data || [];
}

/**
 * Locks a specific tax year
 */
export async function lockTaxYear(booksetId: string, year: number): Promise<void> {
  const { error } = await supabase.rpc('lock_tax_year', {
    p_bookset_id: booksetId,
    p_year: year,
  });

  if (error) throw error;
}

/**
 * Unlocks a specific tax year
 */
export async function unlockTaxYear(booksetId: string, year: number): Promise<void> {
  const { error } = await supabase.rpc('unlock_tax_year', {
    p_bookset_id: booksetId,
    p_year: year,
  });

  if (error) throw error;
}

/**
 * Gets the maximum locked year for a bookset
 */
export async function getMaxLockedYear(booksetId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('get_max_locked_year', {
    p_bookset_id: booksetId,
  });

  if (error) throw error;
  return data;
}

/**
 * Checks if a specific date is in a locked year
 */
export async function isDateLocked(booksetId: string, date: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_date_locked', {
    p_bookset_id: booksetId,
    p_date: date,
  });

  if (error) {
    // If RPC missing, assume not locked
    if (error.code === '42883' || error.message?.includes('404')) {
      return false;
    }
    throw error;
  }
  return data || false;
}
