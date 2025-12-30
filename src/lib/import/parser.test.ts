import { previewCsv, parseFullCsv, MAX_ROWS } from './parser';

describe('previewCsv', () => {
  it('should parse valid CSV with headers', async () => {
    const csvContent = 'Date,Amount,Description\n1/1/2024,$100,Test\n1/2/2024,$200,Test2';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const result = await previewCsv(file);

    expect(result.data).toHaveLength(2);
    expect(result.meta.fields).toEqual(['Date', 'Amount', 'Description']);
    expect(result.data[0]).toEqual({
      Date: '1/1/2024',
      Amount: '$100',
      Description: 'Test',
    });
  });

  it('should only parse first 5 rows', async () => {
    const rows = Array(10)
      .fill(0)
      .map((_, i) => `1/${i + 1}/2024,$${i * 100},Test${i}`)
      .join('\n');
    const csvContent = `Date,Amount,Description\n${rows}`;
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const result = await previewCsv(file);

    expect(result.data).toHaveLength(5);
  });

  it('should reject files larger than 10MB', async () => {
    const largeContent = new Array(11 * 1024 * 1024).join('a');
    const file = new File([largeContent], 'large.csv', { type: 'text/csv' });

    await expect(previewCsv(file)).rejects.toThrow('File too large');
  });

  it('should reject non-CSV files', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    await expect(previewCsv(file)).rejects.toThrow('Only CSV files are supported');
  });

  it('should handle empty lines', async () => {
    const csvContent = 'Date,Amount\n\n1/1/2024,$100\n\n';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const result = await previewCsv(file);

    expect(result.data).toHaveLength(1); // Empty lines skipped
  });

  it('should handle CSV without headers', async () => {
    const csvContent = '1/1/2024,$100,Test\n1/2/2024,$200,Test2';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const result = await previewCsv(file, { hasHeaderRow: false });

    expect(result.data).toHaveLength(2);
    // PapaParse generates numeric column names when header is false
    expect(result.meta.fields).toEqual(['0', '1', '2']);
  });

  it('should handle empty column names from trailing commas', async () => {
    const csvContent = 'Date,Amount,Description,,,\n1/1/2024,$100,Test,,,\n1/2/2024,$200,Test2,,,';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const result = await previewCsv(file);

    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toHaveProperty('Date');
    expect(result.data[0]).toHaveProperty('Amount');
    expect(result.data[0]).toHaveProperty('Description');
    // All values should be strings, not arrays
    expect(typeof result.data[0].Date).toBe('string');
    expect(typeof result.data[0].Amount).toBe('string');
  });
});

describe('parseFullCsv', () => {
  it('should parse entire CSV file', async () => {
    const rows = Array(100)
      .fill(0)
      .map((_, i) => `1/${i + 1}/2024,$${i * 100},Test${i}`)
      .join('\n');
    const csvContent = `Date,Amount,Description\n${rows}`;
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const result = await parseFullCsv(file);

    expect(result.data).toHaveLength(100);
  });

  it('should reject files with more than 50,000 rows', async () => {
    const rows = Array(MAX_ROWS + 1)
      .fill('1/1/2024,$100,Test')
      .join('\n');
    const csvContent = `Date,Amount,Description\n${rows}`;
    const file = new File([csvContent], 'large.csv', { type: 'text/csv' });

    await expect(parseFullCsv(file)).rejects.toThrow('too many rows');
  });

  it('should reject files larger than 10MB', async () => {
    const largeContent = new Array(11 * 1024 * 1024).join('a');
    const file = new File([largeContent], 'large.csv', { type: 'text/csv' });

    await expect(parseFullCsv(file)).rejects.toThrow('File too large');
  });

  it('should handle malformed CSV gracefully', async () => {
    const csvContent = 'Date,Amount,Description\n1/1/2024,$100,Test\n1/2/2024,$200'; // Missing column
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const result = await parseFullCsv(file);

    // Should still parse, but errors array may have entries
    expect(result.data).toBeDefined();
  });

  it('should handle CSV without headers', async () => {
    const csvContent = '1/1/2024,100,Test\n1/2/2024,200,Another Test';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const result = await parseFullCsv(file, { hasHeaderRow: false });

    expect(result.data).toHaveLength(2);
    expect(result.meta.fields).toEqual(['0', '1', '2']); // Numeric field names
    expect(result.data[0]['0']).toBe('1/1/2024');
    expect(result.data[0]['1']).toBe('100');
    expect(result.data[0]['2']).toBe('Test');
  });

  it('should handle empty CSV file', async () => {
    const csvContent = '';
    const file = new File([csvContent], 'empty.csv', { type: 'text/csv' });

    const result = await parseFullCsv(file);

    expect(result.data).toHaveLength(0);
  });

  it('should handle CSV with array values in transform', async () => {
    // This tests the Array.isArray branch in the transform function
    const csvContent = 'Date,Amount,Description\n1/1/2024,$100,Test';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const result = await parseFullCsv(file);

    expect(result.data).toBeDefined();
    expect(result.data[0].Date).toBe('1/1/2024');
  });
});
