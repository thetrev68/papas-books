/**
 * Escapes a string value for CSV export
 * - Wraps value in quotes if it contains commas, quotes, or newlines
 * - Escapes internal quotes by doubling them
 */
export function escapeCsvValue(value: string | null | undefined): string {
  if (value == null) return '';

  const stringValue = String(value);

  // Check if escaping is needed
  if (
    stringValue.includes('"') ||
    stringValue.includes(',') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    // Escape quotes by doubling them, then wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Formats a CSV row from an array of values
 */
export function formatCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map((v) => (typeof v === 'number' ? v : escapeCsvValue(String(v ?? '')))).join(',');
}
