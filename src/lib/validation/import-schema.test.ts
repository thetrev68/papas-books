import { describe, it, expect } from 'vitest';
import { validateMappedTransaction, validateRawCsvRow } from './import-schema';
import type { CsvMapping, DateFormat, AmountMode } from '../../types/import';

describe('validateRawCsvRow', () => {
  it('should succeed for valid signed mapping', () => {
    const row = { Date: '2024-01-01', Amount: '10.00', Description: 'Test' };
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'yyyy-MM-dd' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'signed' as AmountMode,
    };

    const result = validateRawCsvRow(row, mapping);

    expect(result.success).toBe(true);
  });

  it('should fail when a mapped column is missing', () => {
    const row = { Date: '2024-01-01', Description: 'Test' };
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'yyyy-MM-dd' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'signed' as AmountMode,
    };

    const result = validateRawCsvRow(row, mapping);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Missing column "Amount" in CSV row');
    }
  });

  it('should fail when separate mode is missing inflow/outflow mapping', () => {
    const row = { Date: '2024-01-01', Credit: '10.00', Debit: '0', Description: 'Test' };
    const mapping: CsvMapping = {
      dateColumn: 'Date',
      amountColumn: '',
      descriptionColumn: 'Description',
      dateFormat: 'yyyy-MM-dd' as DateFormat,
      hasHeaderRow: true,
      amountMode: 'separate' as AmountMode,
      inflowColumn: '',
      outflowColumn: 'Debit',
    };

    const result = validateRawCsvRow(row, mapping);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Missing mapping for inflow column');
    }
  });
});

describe('validateMappedTransaction', () => {
  it('should succeed for valid mapped data', () => {
    const result = validateMappedTransaction({
      date: '2024-01-01',
      amount: 1000,
      description: 'Test',
    });

    expect(result.success).toBe(true);
  });

  it('should fail for invalid date format', () => {
    const result = validateMappedTransaction({
      date: '01/01/2024',
      amount: 1000,
      description: 'Test',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('YYYY-MM-DD');
    }
  });

  it('should fail for non-integer amount', () => {
    const result = validateMappedTransaction({
      date: '2024-01-01',
      amount: 10.5,
      description: 'Test',
    });

    expect(result.success).toBe(false);
  });
});
