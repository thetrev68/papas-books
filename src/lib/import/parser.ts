import * as Papa from 'papaparse';

export interface ParseResult {
  data: Record<string, string>[]; // Array of objects (if header) or string arrays (if no header)
  meta: {
    fields?: string[]; // Detected column headers
  };
  errors: Papa.ParseError[]; // Parsing errors (malformed rows, etc.)
}

export interface ParseOptions {
  preview?: number; // Max rows to parse (for preview mode)
  hasHeaderRow?: boolean; // Whether to treat first row as headers
}

// Constants for validation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_ROWS = 50000; // 50,000 rows

/**
 * Parse the first 5 rows of a CSV for preview and column detection.
 *
 * @param file - File object from <input type="file">
 * @param options - Optional parsing configuration
 * @returns Promise<ParseResult>
 */
export async function previewCsv(file: File, options?: ParseOptions): Promise<ParseResult> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
  }

  // Validate file type
  if (!file.name.toLowerCase().endsWith('.csv')) {
    throw new Error('Only CSV files are supported.');
  }

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      preview: 5, // Only parse first 5 rows
      header: options?.hasHeaderRow ?? true,
      skipEmptyLines: true, // Ignore blank rows
      transformHeader: (header: string) => {
        // Trim whitespace and handle empty headers
        return header.trim() || '__empty__';
      },
      transform: (value: string) => {
        // Ensure all values are strings (PapaParse can return arrays for duplicate columns)
        return Array.isArray(value) ? value[0] || '' : value;
      },
      complete: (results) => {
        let data = results.data as Record<string, string>[] | string[][];
        let fields = results.meta.fields;

        const hasHeader = options?.hasHeaderRow ?? true;

        // If no header row, data is string[][]. Convert to Record<string, string>[] with index keys
        if (!hasHeader && data.length > 0 && Array.isArray(data[0])) {
          const rows = data as string[][];
          const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
          fields = Array.from({ length: maxCols }, (_, i) => i.toString());

          data = rows.map((row) => {
            const obj: Record<string, string> = {};
            row.forEach((val, i) => {
              obj[i.toString()] = val;
            });
            return obj;
          });
        }

        resolve({
          data: data as Record<string, string>[],
          meta: {
            fields: fields,
          },
          errors: results.errors,
        });
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}

/**
 * Parse the entire CSV file.
 *
 * @param file - File object
 * @param options - Optional parsing configuration
 * @returns Promise<ParseResult>
 */
export async function parseFullCsv(file: File, options?: ParseOptions): Promise<ParseResult> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
  }

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: options?.hasHeaderRow ?? true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        // Trim whitespace and handle empty headers
        return header.trim() || '__empty__';
      },
      transform: (value: string) => {
        // Ensure all values are strings (PapaParse can return arrays for duplicate columns)
        return Array.isArray(value) ? value[0] || '' : value;
      },
      complete: (results) => {
        // Validate row count
        if (results.data.length > MAX_ROWS) {
          reject(
            new Error(`File has too many rows (${results.data.length}). Maximum is ${MAX_ROWS}.`)
          );
          return;
        }

        let data = results.data as Record<string, string>[] | string[][];
        let fields = results.meta.fields;

        const hasHeader = options?.hasHeaderRow ?? true;

        // If no header row, data is string[][]. Convert to Record<string, string>[] with index keys
        if (!hasHeader && data.length > 0 && Array.isArray(data[0])) {
          const rows = data as string[][];
          const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
          fields = Array.from({ length: maxCols }, (_, i) => i.toString());

          data = rows.map((row) => {
            const obj: Record<string, string> = {};
            row.forEach((val, i) => {
              obj[i.toString()] = val;
            });
            return obj;
          });
        }

        resolve({
          data: data as Record<string, string>[],
          meta: {
            fields: fields,
          },
          errors: results.errors,
        });
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}
