import { useState, useMemo } from 'react';
import { useTaxYearLocks } from '../../hooks/useTaxYearLocks';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/config';
import { exportTaxYearLocksToCsv, downloadCsv } from '../../lib/tableExports';

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

  const handleExport = () => {
    const csv = exportTaxYearLocksToCsv(locks, userMap, maxLockedYear);
    const today = new Date().toISOString().split('T')[0];
    downloadCsv(csv, `tax-year-locks-export-${today}.csv`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-gray-100">Tax Year Locking</h2>
        <button
          onClick={handleExport}
          disabled={locks.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-600 dark:bg-gray-600 text-white font-bold rounded-xl shadow hover:bg-neutral-700 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Export tax year locks to CSV"
          title={locks.length > 0 ? 'Export tax year locks to CSV' : 'No locks to export'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export CSV
        </button>
      </div>

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
