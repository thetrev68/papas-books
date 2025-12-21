export type DateFormat = 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'MM-dd-yyyy';

export type AmountMode = 'signed' | 'separate';

export interface CsvMapping {
  // Column Headers (or indices if no header)
  dateColumn: string; // "Date", "Transaction Date", "Posted Date"
  amountColumn: string; // "Amount" (if amountMode='signed')
  descriptionColumn: string; // "Description", "Memo", "Details"

  // Parsing Rules
  dateFormat: DateFormat; // How to interpret date strings
  hasHeaderRow: boolean; // True = first row is column names

  // Advanced Amount Handling
  amountMode: AmountMode; // 'signed' or 'separate'

  // Used only if amountMode === 'separate'
  inflowColumn?: string; // "Credit", "Deposit" (positive amounts)
  outflowColumn?: string; // "Debit", "Withdrawal" (negative amounts)
}

export type InsertCsvMapping = CsvMapping;
export type UpdateCsvMapping = Partial<CsvMapping>;
