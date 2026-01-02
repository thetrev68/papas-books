import { Transaction, Account, Category, Payee, Rule, TaxYearLock } from '../types/database';
import { AccessGrant } from '../types/access';
import { formatCsvRow } from './csvUtils';
import { getCategoryFullName } from './reports';

/**
 * Downloads a CSV file by creating a blob and triggering browser download
 * @param csv - CSV content as string
 * @param filename - Desired filename (should include .csv extension)
 */
export function downloadCsv(csv: string, filename: string): void {
  // Add UTF-8 BOM for Excel compatibility with special characters
  const csvWithBom = '\uFEFF' + csv;
  const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Exports transactions to CSV format
 * Handles split transactions by showing "Split Transaction" in category with details in a separate column
 *
 * @param transactions - Array of transactions to export
 * @param accounts - All accounts for name lookup
 * @param categories - All categories for name lookup
 * @param payees - All payees for name lookup
 * @returns CSV string with headers and data rows
 */
export function exportTransactionsToCsv(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  payees: Payee[]
): string {
  // Build lookup maps
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const payeeMap = new Map(payees.map((p) => [p.id, p]));

  // Headers
  const headers = [
    'Date',
    'Account',
    'Payee',
    'Description',
    'Category',
    'Amount',
    'Reviewed',
    'Reconciled',
    'Split Details',
  ];

  const rows: string[] = [formatCsvRow(headers)];

  for (const tx of transactions) {
    const date = tx.date;
    const accountName = accountMap.get(tx.account_id)?.name || 'Unknown Account';
    const description = tx.original_description;
    const amount = (tx.amount / 100).toFixed(2);
    const reviewed = tx.is_reviewed ? 'Yes' : 'No';
    const reconciled = tx.reconciled ? 'Yes' : 'No';

    // Determine payee name
    let payeeName = '';
    if (tx.payee_id) {
      payeeName = payeeMap.get(tx.payee_id)?.name || '';
    } else if (tx.payee) {
      payeeName = tx.payee;
    }

    // Handle categorization and splits
    let categoryName = 'Uncategorized';
    let splitDetails = '';

    if (tx.is_split && tx.lines && tx.lines.length > 0) {
      // Split transaction
      categoryName = 'Split Transaction';
      splitDetails = tx.lines
        .map((line) => {
          const cat = categoryMap.get(line.category_id);
          const catName = cat ? getCategoryFullName(cat, categories) : 'Unknown';
          const lineAmount = (line.amount / 100).toFixed(2);
          const memo = line.memo ? ` (${line.memo})` : '';
          return `${catName}: $${lineAmount}${memo}`;
        })
        .join(' | ');
    } else if (tx.lines && tx.lines.length > 0) {
      // Simple transaction with category
      const cat = categoryMap.get(tx.lines[0].category_id);
      categoryName = cat ? getCategoryFullName(cat, categories) : 'Uncategorized';
    }

    rows.push(
      formatCsvRow([
        date,
        accountName,
        payeeName,
        description,
        categoryName,
        amount,
        reviewed,
        reconciled,
        splitDetails,
      ])
    );
  }

  return rows.join('\n');
}

/**
 * Exports accounts to CSV format
 *
 * @param accounts - Array of accounts to export
 * @returns CSV string with headers and data rows
 */
export function exportAccountsToCsv(accounts: Account[]): string {
  const headers = [
    'Name',
    'Type',
    'Opening Balance',
    'Opening Date',
    'Last Reconciled Date',
    'Last Reconciled Balance',
    'Status',
  ];

  const rows: string[] = [formatCsvRow(headers)];

  for (const account of accounts) {
    const name = account.name;
    const type = account.type;
    const openingBalance = (account.opening_balance / 100).toFixed(2);
    const openingDate = account.opening_balance_date;
    const lastReconciledDate = account.last_reconciled_date || '-';
    const lastReconciledBalance = (account.last_reconciled_balance / 100).toFixed(2);
    const status = account.is_archived ? 'Archived' : 'Active';

    rows.push(
      formatCsvRow([
        name,
        type,
        openingBalance,
        openingDate,
        lastReconciledDate,
        lastReconciledBalance,
        status,
      ])
    );
  }

  return rows.join('\n');
}

/**
 * Exports categories to CSV format
 * Shows hierarchical parent-child relationships
 *
 * @param categories - Array of categories to export
 * @param categoriesMap - Map of category ID to category for parent lookup
 * @returns CSV string with headers and data rows
 */
export function exportCategoriesToCsv(
  categories: Category[],
  categoriesMap: Map<string, Category>
): string {
  const headers = ['Name', 'Parent Category', 'Tax Deductible', 'Tax Line Item', 'Sort Order'];

  const rows: string[] = [formatCsvRow(headers)];

  for (const category of categories) {
    const name = category.name;
    const parentName = category.parent_category_id
      ? categoriesMap.get(category.parent_category_id)?.name || '-'
      : '-';
    const taxDeductible = category.is_tax_deductible ? 'Yes' : 'No';
    const taxLineItem = category.tax_line_item || '-';
    const sortOrder = category.sort_order.toString();

    rows.push(formatCsvRow([name, parentName, taxDeductible, taxLineItem, sortOrder]));
  }

  return rows.join('\n');
}

/**
 * Exports payees to CSV format
 *
 * @param payees - Array of payees to export
 * @param categories - All categories for default category lookup
 * @returns CSV string with headers and data rows
 */
export function exportPayeesToCsv(payees: Payee[], categories: Category[]): string {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const headers = ['Name', 'Default Category'];

  const rows: string[] = [formatCsvRow(headers)];

  for (const payee of payees) {
    const name = payee.name;
    let defaultCategory = '-';

    if (payee.default_category_id) {
      const cat = categoryMap.get(payee.default_category_id);
      defaultCategory = cat ? getCategoryFullName(cat, categories) : '-';
    }

    rows.push(formatCsvRow([name, defaultCategory]));
  }

  return rows.join('\n');
}

/**
 * Exports rules to CSV format
 *
 * @param rules - Array of rules to export
 * @param categories - All categories for target category lookup
 * @param payees - All payees for payee lookup
 * @returns CSV string with headers and data rows
 */
export function exportRulesToCsv(rules: Rule[], categories: Category[], payees: Payee[]): string {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const payeeMap = new Map(payees.map((p) => [p.id, p]));

  const headers = [
    'Priority',
    'Keyword',
    'Match Type',
    'Target Category',
    'Suggested Payee',
    'Enabled',
    'Use Count',
    'Last Used Date',
  ];

  const rows: string[] = [formatCsvRow(headers)];

  for (const rule of rules) {
    const priority = rule.priority.toString();
    const keyword = rule.keyword;
    const matchType = rule.match_type;

    let targetCategory = '-';
    if (rule.target_category_id) {
      const cat = categoryMap.get(rule.target_category_id);
      targetCategory = cat ? getCategoryFullName(cat, categories) : '-';
    }

    let suggestedPayee = '-';
    if (rule.payee_id) {
      suggestedPayee = payeeMap.get(rule.payee_id)?.name || '-';
    } else if (rule.suggested_payee) {
      suggestedPayee = rule.suggested_payee;
    }

    const enabled = rule.is_enabled ? 'Yes' : 'No';
    const useCount = rule.use_count.toString();
    const lastUsedDate = rule.last_used_at || '-';

    rows.push(
      formatCsvRow([
        priority,
        keyword,
        matchType,
        targetCategory,
        suggestedPayee,
        enabled,
        useCount,
        lastUsedDate,
      ])
    );
  }

  return rows.join('\n');
}

/**
 * Exports tax year locks to CSV format
 *
 * @param locks - Array of tax year locks to export
 * @param userMap - Map of user ID to display name for "Locked By" field
 * @param maxLockedYear - The maximum locked year (for status computation)
 * @returns CSV string with headers and data rows
 */
export function exportTaxYearLocksToCsv(
  locks: TaxYearLock[],
  userMap: Map<string, string>,
  maxLockedYear: number | null
): string {
  const headers = ['Tax Year', 'Status', 'Locked By', 'Locked At'];

  const rows: string[] = [formatCsvRow(headers)];

  for (const lock of locks) {
    const taxYear = lock.tax_year.toString();

    // Compute status
    let status = 'Locked';
    if (maxLockedYear !== null && lock.tax_year < maxLockedYear) {
      status = `Locked by ${maxLockedYear}`;
    }

    const lockedBy = userMap.get(lock.locked_by) || 'Unknown User';
    const lockedAt = new Date(lock.locked_at).toLocaleString();

    rows.push(formatCsvRow([taxYear, status, lockedBy, lockedAt]));
  }

  return rows.join('\n');
}

/**
 * Exports access grants to CSV format
 *
 * @param grants - Array of access grants to export
 * @param userMap - Map of user ID to display name/email
 * @returns CSV string with headers and data rows
 */
export function exportAccessGrantsToCsv(
  grants: AccessGrant[],
  userMap: Map<string, string>
): string {
  const headers = ['User', 'Role', 'Granted At', 'Granted By', 'Status', 'Revoked At'];

  const rows: string[] = [formatCsvRow(headers)];

  for (const grant of grants) {
    const user = userMap.get(grant.userId) || 'Unknown User';
    const role = grant.role.charAt(0).toUpperCase() + grant.role.slice(1); // Capitalize
    const grantedAt = new Date(grant.createdAt).toLocaleString();
    const grantedBy = userMap.get(grant.grantedBy) || 'Unknown User';
    const status = grant.revokedAt ? 'Revoked' : 'Active';
    const revokedAt = grant.revokedAt ? new Date(grant.revokedAt).toLocaleString() : '-';

    rows.push(formatCsvRow([user, role, grantedAt, grantedBy, status, revokedAt]));
  }

  return rows.join('\n');
}
