import { useState } from 'react';
import AppNav from '../components/AppNav';
import { useAuth } from '../context/AuthContext';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { fetchTransactionsForReport } from '../lib/supabase/reports';
import {
  generateCategoryReport,
  filterTransactionsForReport,
  exportReportToCsv,
} from '../lib/reports';
import { CategorySummary, ReportFilter } from '../types/reconcile';
import { Transaction } from '../types/database';

export default function ReportsPage() {
  const { activeBookset } = useAuth();
  const { accounts } = useAccounts();
  const { categories } = useCategories();

  const [startDate, setStartDate] = useState(new Date().getFullYear() + '-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const [reportData, setReportData] = useState<CategorySummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunReport = async () => {
    if (!activeBookset) return;
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch transactions in date range
      const rawTransactions = await fetchTransactionsForReport(
        activeBookset.id,
        startDate,
        endDate
      );

      // 2. Filter in memory
      const filter: ReportFilter = {
        startDate,
        endDate,
        accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
        categoryId: selectedCategoryId || undefined,
      };

      const filteredTransactions = filterTransactionsForReport(
        rawTransactions as Transaction[],
        filter
      );

      // 3. Aggregate
      const summary = generateCategoryReport(filteredTransactions, categories);
      setReportData(summary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!reportData) return;
    const csv = exportReportToCsv(reportData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    window.print();
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = e.target.selectedOptions;
    const values: string[] = [];
    for (let i = 0; i < options.length; i++) {
      values.push(options[i].value);
    }
    setSelectedAccountIds(values);
  };

  const formatMoney = (cents: number) => (cents / 100).toFixed(2);

  return (
    <div>
      <AppNav />
      <div style={{ padding: '2rem' }}>
        <h1>Reports</h1>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '2rem',
            border: '1px solid #ccc',
            padding: '1rem',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            Start Date
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            End Date
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            Accounts (hold Ctrl to select multiple)
            <select
              multiple
              value={selectedAccountIds}
              onChange={handleAccountChange}
              style={{ height: '6rem' }}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            Category
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={handleRunReport}
              disabled={isLoading}
              style={{ padding: '0.5rem 1rem' }}
            >
              {isLoading ? 'Running...' : 'Run Report'}
            </button>
          </div>
        </div>

        {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

        {reportData && (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <button onClick={handleExportCsv} style={{ marginRight: '0.5rem' }}>
                Export CSV
              </button>
              <button onClick={handleExportPdf}>Export PDF (Print)</button>
            </div>

            <table border={1} cellPadding={5} style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  <th style={{ textAlign: 'left' }}>Category</th>
                  <th style={{ textAlign: 'right' }}>Tx Count</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((row) => (
                  <tr key={row.categoryId}>
                    <td>{row.categoryName}</td>
                    <td style={{ textAlign: 'right' }}>{row.transactionCount}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(row.totalAmount)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 'bold', background: '#e0e0e0' }}>
                  <td>TOTAL</td>
                  <td style={{ textAlign: 'right' }}>
                    {reportData.reduce((sum, r) => sum + r.transactionCount, 0)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatMoney(reportData.reduce((sum, r) => sum + r.totalAmount, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
