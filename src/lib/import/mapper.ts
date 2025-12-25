import { parse, isValid as isValidDate } from 'date-fns';
import { CsvMapping } from '../../types/import';
import { sanitizeText, MAX_DESCRIPTION_LENGTH, validateCsvRow } from '../validation/import';
import { validateMappedTransaction, validateRawCsvRow } from '../validation/import-schema';

export interface StagedTransaction {
  // Valid fields (only present if parsing succeeded)
  date?: string; // ISO YYYY-MM-DD
  amount?: number; // Cents (integer)
  description?: string; // Raw description text

  // Validation state
  isValid: boolean; // True if all required fields parsed successfully
  errors: string[]; // Human-readable error messages

  // Source data for debugging
  rawRow: Record<string, string>; // Original CSV row (object or array)
  rowIndex: number; // Row number in CSV (0-based, excluding header)
}

/**
 * Cleans currency strings and converts to cents.
 *
 * Examples:
 * - "$1,234.56" → 123456
 * - "1234.56" → 123456
 * - "($50.00)" → -5000  (parentheses indicate negative)
 * - "-$25.99" → -2599
 * - "1,234" → 123400     (assumes whole dollars if no decimal)
 *
 * @param raw - Raw currency string from CSV
 * @returns Amount in cents (integer), or null if invalid
 */
export function cleanCurrency(raw: string): number | null {
  if (!raw || typeof raw !== 'string') return null;

  // Trim whitespace
  let cleaned = raw.trim();

  // Detect negative via parentheses: "($50.00)"
  const isNegativeParens = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegativeParens) {
    cleaned = cleaned.slice(1, -1); // Remove parentheses
  }

  // Remove currency symbols and commas
  cleaned = cleaned.replace(/[$,]/g, '');

  // Parse as float
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;

  // Convert to cents
  const cents = Math.round(parsed * 100);

  // Apply negative sign if parentheses were used
  return isNegativeParens ? -cents : cents;
}

/**
 * Parses a date string using the specified format.
 *
 * @param raw - Raw date string from CSV
 * @param format - DateFormat enum value (e.g., 'MM/dd/yyyy')
 * @returns ISO date string (YYYY-MM-DD) or null if invalid
 */
export function parseDate(raw: string, format: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  const parsed = parse(raw.trim(), format, new Date());

  if (!isValidDate(parsed)) return null;

  // Return ISO date string (YYYY-MM-DD)
  return parsed.toISOString().split('T')[0];
}

/**
 * Transforms a single raw CSV row into a StagedTransaction.
 *
 * Handles:
 * - Date parsing using specified format
 * - Currency cleaning (remove $, commas, parentheses)
 * - Amount mode logic (signed vs. separate columns)
 * - Validation and error collection
 *
 * @param row - Raw CSV row (object if header=true, array if header=false)
 * @param mapping - CsvMapping configuration
 * @param rowIndex - Row number (for error reporting)
 * @returns StagedTransaction with isValid flag and errors array
 */
export function mapRowToTransaction(
  row: Record<string, string>,
  mapping: CsvMapping,
  rowIndex: number
): StagedTransaction {
  const errors: string[] = [];
  let date: string | undefined;
  let amount: number | undefined;
  let description: string | undefined;

  const rawValidation = validateRawCsvRow(row, mapping);
  if (!rawValidation.success) {
    errors.push(...rawValidation.error.issues.map((issue) => issue.message));
  }

  // Basic field-level validation of raw strings
  const rawDate = row[mapping.dateColumn] || '';
  const rawDescription = row[mapping.descriptionColumn] || '';
  const rawAmount =
    mapping.amountMode === 'signed'
      ? row[mapping.amountColumn] || ''
      : row[mapping.inflowColumn || ''] || row[mapping.outflowColumn || ''] || '';

  const csvValidation = validateCsvRow({
    date: rawDate,
    amount: rawAmount,
    description: rawDescription,
  });

  if (!csvValidation.success) {
    csvValidation.error.issues.forEach((issue) => {
      if (!errors.includes(issue.message)) {
        errors.push(issue.message);
      }
    });
  }

  const shouldParse = errors.length === 0;

  // Extract raw values from row
  // (rawDate and rawDescription already extracted above)

  // Parse date
  if (shouldParse) {
    const parsedDate = parseDate(rawDate, mapping.dateFormat);
    if (!parsedDate) {
      errors.push(`Invalid date: "${rawDate}" (expected format: ${mapping.dateFormat})`);
    } else {
      date = parsedDate;
    }
  }

  // Parse amount (depends on amountMode)
  if (shouldParse) {
    if (mapping.amountMode === 'signed') {
      const rawAmount = row[mapping.amountColumn];
      const parsedAmount = cleanCurrency(rawAmount);

      if (parsedAmount === null) {
        errors.push(`Invalid amount: "${rawAmount}"`);
      } else {
        amount = parsedAmount;
      }
    } else if (mapping.amountMode === 'separate') {
      // Separate debit/credit columns
      const rawInflow = mapping.inflowColumn ? row[mapping.inflowColumn] : '';
      const rawOutflow = mapping.outflowColumn ? row[mapping.outflowColumn] : '';

      const inflow = cleanCurrency(rawInflow);
      const outflow = cleanCurrency(rawOutflow);

      // Logic: Use inflow as positive, outflow as negative
      if (inflow !== null && inflow !== 0) {
        amount = inflow;
      } else if (outflow !== null && outflow !== 0) {
        amount = -Math.abs(outflow); // Ensure negative
      } else {
        errors.push('Missing amount in both inflow and outflow columns');
      }
    }
  }

  // Extract description (with sanitization)
  if (shouldParse) {
    if (rawDescription && typeof rawDescription === 'string') {
      description = sanitizeText(rawDescription, MAX_DESCRIPTION_LENGTH);
      if (!description) {
        errors.push('Description is empty after sanitization');
      }
    } else {
      errors.push('Missing description');
    }
  }

  if (shouldParse && date && amount !== undefined && description) {
    const mappedValidation = validateMappedTransaction({ date, amount, description });
    if (!mappedValidation.success) {
      errors.push(...mappedValidation.error.issues.map((issue) => issue.message));
    }
  }

  return {
    date,
    amount,
    description,
    isValid: errors.length === 0,
    errors,
    rawRow: row,
    rowIndex,
  };
}

/**
 * Maps an array of raw CSV rows to staged transactions.
 *
 * @param rows - Array of raw CSV rows
 * @param mapping - CsvMapping configuration
 * @returns Array of StagedTransactions
 */
export function mapRowsToTransactions(
  rows: Record<string, string>[],
  mapping: CsvMapping
): StagedTransaction[] {
  return rows.map((row, index) => mapRowToTransaction(row, mapping, index));
}
