import { useState, useMemo } from 'react';
import { useTaxYearLocks } from '../../hooks/useTaxYearLocks';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/config';

export default function TaxYearLocksTab() {
  const { locks, lockedYears, maxLockedYear, lockYear, unlockYear, isLocking, isUnlocking } =
    useTaxYearLocks();

  const [showLockConfirm, setShowLockConfirm] = useState<number | null>(null);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState<number | null>(null);

  // Fetch user display names for the locks
  const userIds = useMemo(() => {
    return Array.from(new Set(locks.map((l) => l.locked_by)));
  }, [locks]);

  const { data: users } = useQuery({
    queryKey: ['users', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, email')
        .in('id', userIds);
      if (error) throw error;
      return data;
    },
    enabled: userIds.length > 0,
  });

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users?.forEach((u) => map.set(u.id, u.display_name || u.email));
    return map;
  }, [users]);

  // Generate list of years (current year back to 2020)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i);

  const handleLockYear = (year: number) => {
    lockYear(year);
    setShowLockConfirm(null);
  };

  const handleUnlockYear = (year: number) => {
    unlockYear(year);
    setShowUnlockConfirm(null);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-neutral-900 dark:text-gray-100 mb-4">
        Tax Year Locking
      </h2>

      <p className="text-sm text-neutral-600 dark:text-gray-400 mb-4">
        Lock completed tax years to prevent accidental modifications. Locking a year also locks all
        previous years.
      </p>

      <div className="space-y-2">
        {years.map((year) => {
          const isLocked = lockedYears.includes(year);
          const lock = locks.find((l) => l.tax_year === year);
          const isImplicitlyLocked = maxLockedYear && year < maxLockedYear && !isLocked;

          return (
            <div
              key={year}
              className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-neutral-900 dark:text-gray-100">{year}</span>
                  {isLocked && (
                    <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 text-xs font-bold rounded">
                      Locked
                    </span>
                  )}
                  {isImplicitlyLocked && (
                    <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 text-xs font-bold rounded">
                      Locked (by {maxLockedYear})
                    </span>
                  )}
                </div>
                {isLocked && lock && (
                  <div className="text-[10px] text-neutral-500 dark:text-gray-400 mt-1">
                    Locked by {userMap.get(lock.locked_by) || 'Unknown'} on{' '}
                    {new Date(lock.locked_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {isLocked && (
                  <button
                    onClick={() => setShowUnlockConfirm(year)}
                    disabled={isUnlocking}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    Unlock
                  </button>
                )}
                {!isLocked && !isImplicitlyLocked && (
                  <button
                    onClick={() => setShowLockConfirm(year)}
                    disabled={isLocking}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    Lock
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lock Confirmation Modal */}
      {showLockConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-gray-100 mb-2">
              Lock Tax Year {showLockConfirm}?
            </h3>
            <p className="text-sm text-neutral-600 dark:text-gray-400 mb-4">
              This will prevent all modifications to transactions in {showLockConfirm} and earlier
              years. You can unlock it later if needed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLockConfirm(null)}
                className="px-4 py-2 bg-neutral-200 dark:bg-gray-700 text-neutral-700 dark:text-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleLockYear(showLockConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Lock Year
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Confirmation Modal */}
      {showUnlockConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-gray-100 mb-2">
              Unlock Tax Year {showUnlockConfirm}?
            </h3>
            <p className="text-sm text-neutral-600 dark:text-gray-400 mb-4">
              This will allow modifications to transactions in {showUnlockConfirm}. This does NOT
              unlock earlier years.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowUnlockConfirm(null)}
                className="px-4 py-2 bg-neutral-200 dark:bg-gray-700 text-neutral-700 dark:text-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUnlockYear(showUnlockConfirm)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Unlock Year
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
