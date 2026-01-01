import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { fetchTransactions } from '../lib/supabase/transactions';

type TimeRange = 'month' | 'quarter' | 'year';
type TimePeriod = 'current' | 'prior';

function getRangeBounds(range: TimeRange, period: TimePeriod) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (range === 'month') {
    const monthOffset = period === 'prior' ? -1 : 0;
    start.setMonth(now.getMonth() + monthOffset, 1);
    start.setHours(0, 0, 0, 0);
    if (period === 'prior') {
      end.setMonth(now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
    }
  }

  if (range === 'quarter') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const quarterOffset = period === 'prior' ? -1 : 0;
    const targetQuarter = currentQuarter + quarterOffset;
    const yearOffset = targetQuarter < 0 ? -1 : targetQuarter > 3 ? 1 : 0;
    const normalizedQuarter = ((targetQuarter % 4) + 4) % 4;
    start.setFullYear(now.getFullYear() + yearOffset, normalizedQuarter * 3, 1);
    start.setHours(0, 0, 0, 0);
    if (period === 'prior') {
      end.setFullYear(start.getFullYear(), start.getMonth() + 3, 0);
      end.setHours(23, 59, 59, 999);
    }
  }

  if (range === 'year') {
    const yearOffset = period === 'prior' ? -1 : 0;
    start.setFullYear(now.getFullYear() + yearOffset, 0, 1);
    start.setHours(0, 0, 0, 0);
    if (period === 'prior') {
      end.setFullYear(now.getFullYear() - 1, 11, 31);
      end.setHours(23, 59, 59, 999);
    }
  }

  return { start, end };
}

function getBucketLabels(range: TimeRange, start: Date) {
  if (range === 'month') {
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  }
  if (range === 'quarter') {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return [0, 1, 2].map((offset) => monthNames[start.getMonth() + offset]);
  }
  return ['Q1', 'Q2', 'Q3', 'Q4'];
}

function getBucketIndex(range: TimeRange, start: Date, date: Date) {
  if (range === 'month') {
    const diffDays = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(3, Math.floor(diffDays / 7)));
  }
  if (range === 'quarter') {
    return date.getMonth() - start.getMonth();
  }
  return Math.floor(date.getMonth() / 3);
}

export default function DashboardPage() {
  const { activeBookset } = useAuth();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('current');
  const [recentActivityLimit, setRecentActivityLimit] = useState(5);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions', activeBookset?.id],
    queryFn: () => (activeBookset ? fetchTransactions(activeBookset.id) : Promise.resolve([])),
    enabled: !!activeBookset,
  });

  // Server-side filtering of is_archived now handled in fetchTransactions
  const normalizedTransactions = useMemo(() => transactions || [], [transactions]);

  const range = useMemo(() => getRangeBounds(timeRange, timePeriod), [timeRange, timePeriod]);

  const periodTransactions = useMemo(() => {
    return normalizedTransactions.filter((t) => {
      const date = new Date(t.date);
      return date >= range.start && date <= range.end;
    });
  }, [normalizedTransactions, range]);

  const kpiData = useMemo(() => {
    if (!accounts) {
      return {
        totalCash: 0,
        netIncome: 0,
        netExpenses: 0,
        uncategorizedCount: 0,
      };
    }

    const assetAccounts = accounts.filter((acc) => acc.type === 'Asset');
    const assetAccountIds = new Set(assetAccounts.map((acc) => acc.id));
    const openingTotal = assetAccounts.reduce((sum, acc) => sum + acc.opening_balance, 0);
    const transactionTotal = normalizedTransactions
      .filter((t) => assetAccountIds.has(t.account_id))
      .reduce((sum, t) => sum + t.amount, 0);
    const totalCash = openingTotal + transactionTotal;

    const uncategorizedCount = normalizedTransactions.filter((t) => {
      const hasCategory = (t.lines || []).some((line) => line.category_id);
      return !hasCategory;
    }).length;

    const netIncomeTotal = periodTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = periodTransactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalCash,
      netIncome: netIncomeTotal + expenseTotal,
      netExpenses: Math.abs(expenseTotal),
      uncategorizedCount,
    };
  }, [accounts, normalizedTransactions, periodTransactions]);

  const recentActivity = useMemo(() => {
    return [...normalizedTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, recentActivityLimit);
  }, [normalizedTransactions, recentActivityLimit]);

  const topCategories = useMemo(() => {
    const categoryTotals = new Map<string, number>();
    const categoryNameMap = new Map(categories.map((cat) => [cat.id, cat.name]));

    periodTransactions.forEach((tx) => {
      const lines = tx.lines?.length
        ? tx.lines
        : [{ category_id: null, amount: tx.amount, memo: '' }];

      lines.forEach((line) => {
        if (line.amount >= 0) return;
        const key = line.category_id || 'uncategorized';
        const current = categoryTotals.get(key) || 0;
        categoryTotals.set(key, current + Math.abs(line.amount));
      });
    });

    return Array.from(categoryTotals.entries())
      .map(([id, amount]) => ({
        id,
        name: id === 'uncategorized' ? 'Uncategorized' : categoryNameMap.get(id) || 'Unknown',
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [categories, periodTransactions]);

  const trendBuckets = useMemo(() => {
    const labels = getBucketLabels(timeRange, range.start);
    const totals = labels.map(() => 0);

    periodTransactions.forEach((tx) => {
      const date = new Date(tx.date);
      const bucketIndex = getBucketIndex(timeRange, range.start, date);
      const lines = tx.lines?.length
        ? tx.lines
        : [{ category_id: null, amount: tx.amount, memo: '' }];

      lines.forEach((line) => {
        if (line.amount >= 0) return;
        if (bucketIndex < 0 || bucketIndex >= totals.length) return;
        totals[bucketIndex] += Math.abs(line.amount);
      });
    });

    const maxValue = Math.max(...totals, 1);
    return labels.map((label, index) => ({
      label,
      value: totals[index],
      percent: Math.round((totals[index] / maxValue) * 100),
    }));
  }, [periodTransactions, range.start, timeRange]);

  const formatMoney = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-gray-100 mb-2">Dashboard</h2>
        <p className="text-lg text-neutral-600 dark:text-gray-400">
          A clear snapshot of how things are going right now.
        </p>
      </header>

      {/* Time Range */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-neutral-500 dark:text-gray-400 uppercase tracking-wide">
          Range
        </span>
        <div className="inline-flex rounded-xl border-2 border-neutral-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
          {(['month', 'quarter', 'year'] as const).map((rangeOption) => (
            <button
              key={rangeOption}
              onClick={() => setTimeRange(rangeOption)}
              className={`px-4 py-2 rounded-lg font-bold capitalize transition-colors ${
                timeRange === rangeOption
                  ? 'bg-brand-600 text-white'
                  : 'text-neutral-600 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-gray-700'
              }`}
            >
              {rangeOption}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-xl border-2 border-neutral-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
          {(['current', 'prior'] as const).map((periodOption) => (
            <button
              key={periodOption}
              onClick={() => setTimePeriod(periodOption)}
              className={`px-4 py-2 rounded-lg font-bold capitalize transition-colors ${
                timePeriod === periodOption
                  ? 'bg-neutral-900 dark:bg-gray-600 text-white'
                  : 'text-neutral-600 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-gray-700'
              }`}
            >
              {periodOption}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-bold text-neutral-500 dark:text-gray-400 uppercase tracking-wide">
            Total Cash
          </p>
          <div className="text-3xl font-bold text-neutral-900 dark:text-gray-100 mt-2">
            {formatMoney(kpiData.totalCash)}
          </div>
          <p className="text-sm text-neutral-500 font-semibold mt-2">Across asset accounts</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-bold text-neutral-500 dark:text-gray-400 uppercase tracking-wide">
            Net Income ({timePeriod} {timeRange})
          </p>
          <div className="text-3xl font-bold text-success-700 dark:text-green-400 mt-2">
            {formatMoney(kpiData.netIncome)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-bold text-neutral-500 dark:text-gray-400 uppercase tracking-wide">
            Net Expenses ({timePeriod} {timeRange})
          </p>
          <div className="text-3xl font-bold text-danger-700 dark:text-red-400 mt-2">
            {formatMoney(kpiData.netExpenses)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-bold text-neutral-500 dark:text-gray-400 uppercase tracking-wide">
            Uncategorized
          </p>
          <div className="text-3xl font-bold text-neutral-900 dark:text-gray-100 mt-2">
            {kpiData.uncategorizedCount}
          </div>
          <Link
            to="/app/workbench"
            className="text-sm text-brand-600 font-bold mt-2 hover:underline block"
          >
            Review Transactions &rarr;
          </Link>
        </div>
      </div>

      {/* Alerts + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-xl font-bold text-neutral-900 dark:text-gray-100 mb-4">
            Alerts & Tasks
          </h3>
          <div className="space-y-3">
            {kpiData.uncategorizedCount > 0 ? (
              <Link
                to="/app/workbench"
                className="block w-full text-left p-4 rounded-xl border-2 border-danger-100 dark:border-red-800 bg-danger-100 dark:bg-red-900 text-danger-700 dark:text-red-200 font-bold hover:bg-danger-200 dark:hover:bg-red-800 transition-colors"
              >
                {kpiData.uncategorizedCount} transactions need review
              </Link>
            ) : (
              <div className="p-4 rounded-xl border-2 border-success-100 dark:border-green-800 bg-success-100 dark:bg-green-900 text-success-700 dark:text-green-200 font-bold">
                All transactions reviewed!
              </div>
            )}

            {accounts?.some((a) => !a.last_reconciled_date) && (
              <Link
                to="/app/reconcile"
                className="block w-full text-left p-4 rounded-xl border-2 border-neutral-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-neutral-700 dark:text-gray-300 font-bold hover:border-brand-500 dark:hover:bg-gray-700 transition-colors"
              >
                Reconcile your accounts
              </Link>
            )}
            <Link
              to="/app/import"
              className="block w-full text-left p-4 rounded-xl border-2 border-neutral-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-neutral-700 dark:text-gray-300 font-bold hover:border-brand-500 dark:hover:bg-gray-700 transition-colors"
            >
              Review recent imports
            </Link>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-xl font-bold text-neutral-900 dark:text-gray-100 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to="/app/import"
              className="flex items-center justify-center p-5 bg-brand-600 text-white text-lg font-bold rounded-xl shadow hover:bg-brand-700 transition-colors"
            >
              Import CSV
            </Link>
            <Link
              to="/app/workbench"
              className="flex items-center justify-center p-5 bg-white dark:bg-gray-800 border-2 border-brand-600 dark:border-brand-500 text-brand-700 dark:text-brand-400 text-lg font-bold rounded-xl hover:bg-brand-50 dark:hover:bg-gray-700 transition-colors"
            >
              Add Transaction
            </Link>
            <Link
              to="/app/reconcile"
              className="flex items-center justify-center p-5 bg-white dark:bg-gray-800 border-2 border-neutral-300 dark:border-gray-600 text-neutral-700 dark:text-gray-300 text-lg font-bold rounded-xl hover:bg-neutral-50 dark:hover:bg-gray-700 transition-colors"
            >
              Reconcile
            </Link>
            <Link
              to="/app/reports"
              className="flex items-center justify-center p-5 bg-white dark:bg-gray-800 border-2 border-neutral-300 dark:border-gray-600 text-neutral-700 dark:text-gray-300 text-lg font-bold rounded-xl hover:bg-neutral-50 dark:hover:bg-gray-700 transition-colors"
            >
              View Reports
            </Link>
          </div>
        </div>
      </div>

      {/* Trends + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm space-y-6">
          <div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-gray-100 mb-4">
              Spending Trend
            </h3>
            <div className="space-y-3">
              {trendBuckets.map((bucket) => (
                <div key={bucket.label}>
                  <div className="flex justify-between text-sm text-neutral-500 dark:text-gray-400 font-bold mb-1">
                    <span>{bucket.label}</span>
                    <span>{formatMoney(bucket.value)}</span>
                  </div>
                  <div className="h-4 rounded-full bg-neutral-100 dark:bg-gray-700">
                    <div
                      className="h-4 rounded-full bg-brand-600 dark:bg-brand-500"
                      style={{ width: `${bucket.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-gray-100 mb-4">
              Top Categories
            </h3>
            {topCategories.length === 0 ? (
              <div className="text-neutral-500 dark:text-gray-400">No expenses in this range.</div>
            ) : (
              <div className="space-y-3">
                {topCategories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between">
                    <span className="font-bold text-neutral-900 dark:text-gray-100">
                      {cat.name}
                    </span>
                    <span className="font-bold text-neutral-900 dark:text-gray-100">
                      {formatMoney(cat.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-xl font-bold text-neutral-900 dark:text-gray-100 mb-4">
            Recent Activity
          </h3>
          <div className="space-y-4">
            {isLoading ? (
              <div>Loading activity...</div>
            ) : recentActivity.length === 0 ? (
              <div className="text-neutral-500">No recent activity.</div>
            ) : (
              recentActivity.map((t) => {
                const categoryId = t.lines?.[0]?.category_id;
                const categoryName =
                  categories.find((cat) => cat.id === categoryId)?.name ||
                  (t.is_split ? 'Split' : 'Uncategorized');
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2 hover:bg-neutral-50 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <div className="font-bold text-neutral-900 dark:text-gray-100 text-lg">
                        {t.payee || t.original_description}
                      </div>
                      <div className="text-sm text-neutral-500 dark:text-gray-400 font-medium">
                        {new Date(t.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-bold text-lg ${t.amount < 0 ? 'text-danger-700 dark:text-red-400' : 'text-success-700 dark:text-green-400'}`}
                      >
                        {formatMoney(t.amount)}
                      </div>
                      <div className="text-sm font-bold text-neutral-500 dark:text-gray-400 uppercase tracking-wide mt-1">
                        {categoryName}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-gray-700 space-y-2">
            {normalizedTransactions.length > recentActivityLimit && (
              <button
                onClick={() => setRecentActivityLimit((prev) => prev + 10)}
                className="w-full py-2 px-4 bg-neutral-100 dark:bg-gray-700 text-neutral-700 dark:text-gray-300 font-bold rounded-lg hover:bg-neutral-200 dark:hover:bg-gray-600 transition-colors"
              >
                Load More ({normalizedTransactions.length - recentActivityLimit} remaining)
              </button>
            )}
            <Link
              to="/app/workbench"
              className="block text-center text-brand-600 dark:text-brand-400 font-bold hover:underline"
            >
              View All Activity &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
