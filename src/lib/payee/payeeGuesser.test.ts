import { describe, it, expect } from 'vitest';
import { guessPayee } from './payeeGuesser';
import type { Payee } from '../../types/database';

describe('payeeGuesser', () => {
  const mockPayees: Payee[] = [
    {
      id: '1',
      bookset_id: 'bs1',
      name: 'Starbucks',
      aliases: ['POS PURCHASE STARBUCKS', 'STARBUCKS #123', 'STARBUCKS STORE'],
      category_id: 'cat1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'user1',
      last_modified_by: 'user1',
    },
    {
      id: '2',
      bookset_id: 'bs1',
      name: 'Amazon',
      aliases: ['AMAZON.COM', 'AMAZON PURCHASE'],
      category_id: 'cat2',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'user1',
      last_modified_by: 'user1',
    },
  ];

  describe('guessPayee', () => {
    it('returns exact alias match with 100% confidence', () => {
      const result = guessPayee('POS PURCHASE STARBUCKS', mockPayees);
      expect(result.payee).toEqual(mockPayees[0]);
      expect(result.confidence).toBe(100);
    });

    it('returns fuzzy name match with 80% confidence', () => {
      const result = guessPayee('STARBUCKS COFFEE SHOP', mockPayees);
      expect(result.payee).toEqual(mockPayees[0]);
      expect(result.confidence).toBe(80);
    });

    it('extracts merchant name and suggests new payee with 60% confidence', () => {
      const result = guessPayee('POS PURCHASE COFFEE BEAN', mockPayees);
      expect(result.payee).toBeNull();
      expect(result.suggestedName).toBe('PURCHASE COFFEE BEAN');
      expect(result.confidence).toBe(60);
    });

    it('removes common prefixes when extracting merchant name', () => {
      const result = guessPayee('POS PURCHASE MCDONALDS #456', mockPayees);
      expect(result.payee).toBeNull();
      expect(result.suggestedName).toBe('MCDONALDS');
      expect(result.confidence).toBe(60);
    });

    it('removes common suffixes when extracting merchant name', () => {
      const result = guessPayee('CHECK PAYMENT WALMART STORE', mockPayees);
      expect(result.payee).toBeNull();
      expect(result.suggestedName).toBe('PAYMENT WALMART STORE');
      expect(result.confidence).toBe(60);
    });

    it('returns low confidence for unrecognized descriptions', () => {
      const result = guessPayee('RANDOM TRANSACTION', mockPayees);
      expect(result.payee).toBeNull();
      expect(result.suggestedName).toBe('RANDOM');
      expect(result.confidence).toBe(60);
    });

    it('handles empty payees list', () => {
      const result = guessPayee('POS PURCHASE STARBUCKS', []);
      expect(result.payee).toBeNull();
      expect(result.suggestedName).toBe('PURCHASE STARBUCKS');
      expect(result.confidence).toBe(60);
    });

    it('prioritizes exact alias matches over fuzzy matches', () => {
      const payeesWithOverlap: Payee[] = [
        {
          id: '1',
          bookset_id: 'bs1',
          name: 'Starbucks',
          aliases: ['STARBUCKS'],
          category_id: 'cat1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          created_by: 'user1',
          last_modified_by: 'user1',
        },
        {
          id: '2',
          bookset_id: 'bs1',
          name: 'Starbucks Coffee',
          aliases: ['POS PURCHASE STARBUCKS'],
          category_id: 'cat1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          created_by: 'user1',
          last_modified_by: 'user1',
        },
      ];

      const result = guessPayee('POS PURCHASE STARBUCKS', payeesWithOverlap);
      expect(result.payee).toEqual(payeesWithOverlap[1]); // Exact alias match
      expect(result.confidence).toBe(100);
    });

    it('takes first 3 words as merchant name', () => {
      const result = guessPayee('POS PURCHASE VERY LONG MERCHANT NAME HERE', mockPayees);
      expect(result.payee).toBeNull();
      expect(result.suggestedName).toBe('PURCHASE VERY LONG');
      expect(result.confidence).toBe(60);
    });

    it('handles case insensitive matching', () => {
      const result = guessPayee('pos purchase amazon.com', mockPayees);
      expect(result.payee).toBeNull();
      expect(result.suggestedName).toBe('purchase amazon.com');
      expect(result.confidence).toBe(60);
    });
  });
});
