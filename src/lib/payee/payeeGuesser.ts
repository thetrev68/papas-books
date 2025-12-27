import type { Payee } from '../../types/database';

export interface PayeeGuess {
  payee: Payee | null;
  suggestedName?: string;
  confidence: number;
}

/**
 * Guesses payee from description using existing payees
 */
export function guessPayee(description: string, existingPayees: Payee[]): PayeeGuess {
  // 1. Fuzzy match against payee names
  const words = description.toLowerCase().split(/\s+/);
  for (const payee of existingPayees) {
    const payeeWords = payee.name.toLowerCase().split(/\s+/);
    const commonWords = words.filter((word) => payeeWords.includes(word));

    if (commonWords.length >= Math.min(words.length, payeeWords.length) * 0.8) {
      return { payee, confidence: 80 };
    }
  }

  // 3. Extract merchant name using heuristics
  const merchantName = extractMerchantName(description);
  if (merchantName) {
    return {
      payee: null,
      suggestedName: merchantName,
      confidence: 60,
    };
  }

  return { payee: null, confidence: 0 };
}

/**
 * Extracts merchant name from bank description
 */
function extractMerchantName(description: string): string | null {
  // Remove common banking prefixes and transaction types
  const clean = description
    .replace(/^(POS|DEBIT|CHECK|ATM|ONLINE|WEB|ACH|CREDIT|CHARGE)\s+/i, '')
    .replace(/(^|\s+)(PURCHASE|PAYMENT|WITHDRAWAL|DEPOSIT|TRANSFER|TRANSACTION)(\s|$)/i, ' ') // Remove transaction types
    .replace(/\s+(#\d+|[A-Z]{2}\d{2,}|REF|REFUND)$/i, '') // Remove reference numbers
    .trim();

  // If the description is too short after cleaning, return null
  if (clean.length < 2) {
    return null;
  }

  // Take first 2-3 words as merchant name
  const words = clean.split(/\s+/).slice(0, 3);
  return words.join(' ');
}
