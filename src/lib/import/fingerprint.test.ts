import { normalizeDescription, generateFingerprint, addFingerprints } from './fingerprint';
import type { StagedTransaction } from './mapper';

describe('normalizeDescription', () => {
  it('should trim whitespace', () => {
    expect(normalizeDescription('  Target  ')).toBe('target');
  });

  it('should convert to lowercase', () => {
    expect(normalizeDescription('TARGET')).toBe('target');
    expect(normalizeDescription('TaRgEt')).toBe('target');
  });

  it('should replace multiple spaces with single space', () => {
    expect(normalizeDescription('Target   Store')).toBe('target store');
    expect(normalizeDescription('Target     Store    Inc')).toBe('target store inc');
  });

  it('should handle combination of transformations', () => {
    expect(normalizeDescription('  TARGET   STORE  ')).toBe('target store');
  });
});

describe('generateFingerprint', () => {
  it('should produce identical hash for identical inputs', async () => {
    const hash1 = await generateFingerprint('2024-01-15', 10000, 'Target');
    const hash2 = await generateFingerprint('2024-01-15', 10000, 'Target');
    expect(hash1).toBe(hash2);
  });

  it('should ignore case differences in description', async () => {
    const hash1 = await generateFingerprint('2024-01-15', 10000, 'Target');
    const hash2 = await generateFingerprint('2024-01-15', 10000, 'TARGET');
    const hash3 = await generateFingerprint('2024-01-15', 10000, 'target');
    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it('should ignore extra whitespace in description', async () => {
    const hash1 = await generateFingerprint('2024-01-15', 10000, 'Target');
    const hash2 = await generateFingerprint('2024-01-15', 10000, '  Target  ');
    const hash3 = await generateFingerprint('2024-01-15', 10000, 'Target   Store');
    const hash4 = await generateFingerprint('2024-01-15', 10000, 'Target Store');

    expect(hash1).toBe(hash2);
    expect(hash3).toBe(hash4);
  });

  it('should produce different hash for different amounts', async () => {
    const hash1 = await generateFingerprint('2024-01-15', 10000, 'Target');
    const hash2 = await generateFingerprint('2024-01-15', 20000, 'Target');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hash for different dates', async () => {
    const hash1 = await generateFingerprint('2024-01-15', 10000, 'Target');
    const hash2 = await generateFingerprint('2024-01-16', 10000, 'Target');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hash for different descriptions', async () => {
    const hash1 = await generateFingerprint('2024-01-15', 10000, 'Target');
    const hash2 = await generateFingerprint('2024-01-15', 10000, 'Walmart');
    expect(hash1).not.toBe(hash2);
  });

  it('should return a valid hex string', async () => {
    const hash = await generateFingerprint('2024-01-15', 10000, 'Target');

    // SHA-256 produces 64 character hex string
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should handle negative amounts', async () => {
    const hash1 = await generateFingerprint('2024-01-15', -10000, 'Target');
    const hash2 = await generateFingerprint('2024-01-15', 10000, 'Target');
    expect(hash1).not.toBe(hash2);
  });
});

describe('addFingerprints', () => {
  it('should add fingerprints to valid transactions', async () => {
    const transactions: StagedTransaction[] = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 0,
      },
      {
        date: '2024-01-16',
        amount: 20000,
        description: 'Walmart',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 1,
      },
    ];

    const result = await addFingerprints(transactions);

    expect(result).toHaveLength(2);
    expect(result[0].fingerprint).toBeDefined();
    expect(result[1].fingerprint).toBeDefined();
    expect(result[0].fingerprint).toHaveLength(64);
    expect(result[1].fingerprint).toHaveLength(64);
  });

  it('should only fingerprint valid transactions', async () => {
    const transactions: StagedTransaction[] = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 0,
      },
      {
        date: undefined,
        amount: undefined,
        description: undefined,
        isValid: false,
        errors: ['Invalid date'],
        rawRow: {},
        rowIndex: 1,
      },
    ];

    const result = await addFingerprints(transactions);

    expect(result).toHaveLength(1); // Only valid transaction
    expect(result[0].fingerprint).toBeDefined();
  });

  it('should preserve original transaction properties', async () => {
    const transactions: StagedTransaction[] = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: { original: 'data' },
        rowIndex: 5,
      },
    ];

    const result = await addFingerprints(transactions);

    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].amount).toBe(10000);
    expect(result[0].description).toBe('Target');
    expect(result[0].isValid).toBe(true);
    expect(result[0].rawRow).toEqual({ original: 'data' });
    expect(result[0].rowIndex).toBe(5);
  });

  it('should produce consistent fingerprints for same data', async () => {
    const transactions: StagedTransaction[] = [
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'Target',
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 0,
      },
      {
        date: '2024-01-15',
        amount: 10000,
        description: 'TARGET', // Different case, should produce same fingerprint
        isValid: true,
        errors: [],
        rawRow: {},
        rowIndex: 1,
      },
    ];

    const result = await addFingerprints(transactions);

    expect(result[0].fingerprint).toBe(result[1].fingerprint);
  });
});
