import { describe, it, expect } from 'vitest';
import { cleanCurrency, parseDate, mapRowToTransaction, mapRowsToTransactions } from './mapper';
import type { CsvMapping, DateFormat, AmountMode } from '../../types/import';

describe('cleanCurrency', () => {
  it('should clean "$1,234.56" to 123456', () => {
    expect(cleanCurrency('$1,234.56')).toBe(123456);
  });

  it('should clean "($50.00)" to -5000', () => {
    expect(cleanCurrency('($50.00)')).toBe(-5000);
  });

  it('should clean "-$25.99" to -2599', () => {
    expect(cleanCurrency('-$25.99')).toBe(-2599);
  });

  it('should handle whole dollars', () => {
    expect(cleanCurrency('$1,234')).toBe(123400);
  });

  it('should handle plain numbers', () => {
    expect(cleanCurrency('1234.56')).toBe(123456);
  });

  it('should return null for invalid input', () => {
    expect(cleanCurrency('invalid')).toBeNull();
    expect(cleanCurrency('')).toBeNull();
  });

  it('should handle whitespace', () => {
    expect(cleanCurrency('  $100.00  ')).toBe(10000);
  });

  it('should handle negative with parentheses and dollar sign', () => {
    expect(cleanCurrency('($1,234.56)')).toBe(-123456);
  });
});

describe('parseDate', () => {
  it('should parse "1/15/2024" with "MM/dd/yyyy"', () => {
    expect(parseDate('1/15/2024', 'MM/dd/yyyy')).toBe('2024-01-15');
  });

  it('should parse "15/1/2024" with "dd/MM/yyyy"', () => {
    expect(parseDate('15/1/2024', 'dd/MM/yyyy')).toBe('2024-01-15');
  });

  it('should parse "2024-01-15" with "yyyy-MM-dd"', () => {
    expect(parseDate('2024-01-15', 'yyyy-MM-dd')).toBe('2024-01-15');
  });

  it('should parse "01-15-2024" with "MM-dd-yyyy"', () => {
    expect(parseDate('01-15-2024', 'MM-dd-yyyy')).toBe('2024-01-15');
  });

  it('should return null for invalid date', () => {
    expect(parseDate('invalid', 'MM/dd/yyyy')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseDate('', 'MM/dd/yyyy')).toBeNull();
  });

  it('should handle whitespace', () => {
    expect(parseDate('  1/15/2024  ', 'MM/dd/yyyy')).toBe('2024-01-15');
  });

  it('should reject invalid dates like 13/32/2024', () => {
    expect(parseDate('13/32/2024', 'MM/dd/yyyy')).toBeNull();
  });
});

describe('mapRowToTransaction', () => {
  it('should map valid row with signed amount', () => {
    const row = { Date: '1/15/2024', Amount: '$100.00', Description: 'Test' };
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'signed' as AmountMode,
    };

    const result = mapRowToTransaction(row, mapping, 0);

    expect(result.isValid).toBe(true);
    expect(result.date).toBe('2024-01-15');
    expect(result.amount).toBe(10000);
    expect(result.description).toBe('Test');
    expect(result.errors).toHaveLength(0);
  });

  it('should map valid row with negative signed amount', () => {
    const row = { Date: '1/15/2024', Amount: '-$50.00', Description: 'Test' };
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'signed' as AmountMode,
    };

    const result = mapRowToTransaction(row, mapping, 0);

    expect(result.isValid).toBe(true);
    expect(result.amount).toBe(-5000);
  });

  it('should handle separate debit/credit columns with inflow', () => {
    const row = { Date: '1/15/2024', Credit: '$100.00', Debit: '', Description: 'Test' };
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: '',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'separate' as AmountMode,
      inflowColumn: 'Credit',
      outflowColumn: 'Debit',
    };

    const result = mapRowToTransaction(row, mapping, 0);

    expect(result.isValid).toBe(true);
    expect(result.amount).toBe(10000); // Positive inflow
  });

  it('should handle separate debit/credit columns with outflow', () => {
    const row = { Date: '1/15/2024', Credit: '', Debit: '$50.00', Description: 'Test' };
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: '',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'separate' as AmountMode,
      inflowColumn: 'Credit',
      outflowColumn: 'Debit',
    };

    const result = mapRowToTransaction(row, mapping, 0);

    expect(result.isValid).toBe(true);
    expect(result.amount).toBe(-5000); // Negative outflow
  });

  it('should return errors for invalid date', () => {
    const row = { Date: 'invalid', Amount: '$100', Description: 'Test' };
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'signed' as AmountMode,
    };

    const result = mapRowToTransaction(row, mapping, 0);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Invalid date');
  });

  it('should return errors for invalid amount', () => {
    const row = { Date: '1/15/2024', Amount: 'bad', Description: 'Test' };
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'signed' as AmountMode,
    };

    const result = mapRowToTransaction(row, mapping, 0);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid amount: "bad"');
  });

  it('should return errors for missing description', () => {
    const row = { Date: '1/15/2024', Amount: '$100', Description: '' };
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'signed' as AmountMode,
    };

    const result = mapRowToTransaction(row, mapping, 0);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing description');
  });

  it('should collect multiple errors', () => {
    const row = { Date: 'invalid', Amount: 'bad', Description: '' };
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'signed' as AmountMode,
    };

    const result = mapRowToTransaction(row, mapping, 0);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(3); // Date, amount, description
  });

  it('should preserve raw row data for debugging', () => {
    const row = { Date: '1/15/2024', Amount: '$100', Description: 'Test' };
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'signed' as AmountMode,
    };

    const result = mapRowToTransaction(row, mapping, 5);

    expect(result.rawRow).toEqual(row);
    expect(result.rowIndex).toBe(5);
  });
});

describe('mapRowsToTransactions', () => {
  it('should map array of rows', () => {
    const rows = [
      { Date: '1/15/2024', Amount: '$100', Description: 'Test1' },
      { Date: '1/16/2024', Amount: '$200', Description: 'Test2' },
    ];
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'signed' as AmountMode,
    };

    const results = mapRowsToTransactions(rows, mapping);

    expect(results).toHaveLength(2);
    expect(results[0].isValid).toBe(true);
    expect(results[1].isValid).toBe(true);
    expect(results[0].rowIndex).toBe(0);
    expect(results[1].rowIndex).toBe(1);
  });
});
