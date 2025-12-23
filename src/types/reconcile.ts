export interface Reconciliation {
  id: string;
  booksetId: string;
  accountId: string;
  statementDate: string; // ISO date
  statementBalance: number; // cents
  openingBalance: number; // cents
  calculatedBalance: number; // cents
  difference: number; // cents
  status: 'in_progress' | 'balanced' | 'unbalanced';
  finalizedAt?: string;
  transactionCount: number;
  transactionIds: string[];
}

export interface ReconciliationInput {
  accountId: string;
  statementDate: string; // YYYY-MM-DD
  statementBalance: number; // cents
}

export interface ReconciliationResult {
  openingBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  calculatedEndingBalance: number;
  difference: number;
  isBalanced: boolean;
}

export interface ReportFilter {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  accountIds?: string[];
  categoryId?: string;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  totalAmount: number; // cents
  transactionCount: number;
  isIncome: boolean;
}

export interface ReportExportRow {
  categoryName: string;
  totalAmount: number;
  transactionCount: number;
}
