import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { fetchTaxYearLocks, lockTaxYear, unlockTaxYear } from '../lib/supabase/taxYearLocks';
import { useToast } from '../components/GlobalToastProvider';

export function useTaxYearLocks() {
  const { activeBookset } = useAuth();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();

  // Fetch locked years
  const { data: locks = [], isLoading } = useQuery({
    queryKey: ['taxYearLocks', activeBookset?.id],
    queryFn: () => fetchTaxYearLocks(activeBookset!.id),
    enabled: !!activeBookset,
  });

  const lockedYears = locks.map((l) => l.tax_year);

  // Get max locked year
  const maxLockedYear = lockedYears.length > 0 ? Math.max(...lockedYears) : null;

  // Helper function: is a specific date locked?
  const isDateLocked = (dateStr: string): boolean => {
    if (!maxLockedYear) return false;
    // Parse year directly from YYYY-MM-DD format to avoid timezone issues
    const year = parseInt(dateStr.split('-')[0], 10);
    return year <= maxLockedYear;
  };

  // Lock year mutation
  const lockYearMutation = useMutation({
    mutationFn: (year: number) => {
      if (!activeBookset) throw new Error('No active bookset');
      return lockTaxYear(activeBookset.id, year);
    },
    onSuccess: (_, year) => {
      queryClient.invalidateQueries({ queryKey: ['taxYearLocks', activeBookset?.id] });
      showSuccess(`Tax year ${year} has been locked`);
    },
    onError: (error: Error) => {
      showError(`Failed to lock tax year: ${error.message}`);
    },
  });

  // Unlock year mutation
  const unlockYearMutation = useMutation({
    mutationFn: (year: number) => {
      if (!activeBookset) throw new Error('No active bookset');
      return unlockTaxYear(activeBookset.id, year);
    },
    onSuccess: (_, year) => {
      queryClient.invalidateQueries({ queryKey: ['taxYearLocks', activeBookset?.id] });
      showSuccess(`Tax year ${year} has been unlocked`);
    },
    onError: (error: Error) => {
      showError(`Failed to unlock tax year: ${error.message}`);
    },
  });

  return {
    locks,
    lockedYears,
    maxLockedYear,
    isLoading,
    isDateLocked,
    lockYear: lockYearMutation.mutate,
    unlockYear: unlockYearMutation.mutate,
    isLocking: lockYearMutation.isPending,
    isUnlocking: unlockYearMutation.isPending,
  };
}
