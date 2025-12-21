import { StagedTransaction } from './mapper';

/**
 * Normalizes a description string for consistent fingerprinting.
 *
 * Rules:
 * - Trim whitespace
 * - Convert to lowercase
 * - Replace multiple spaces with single space
 *
 * @param description - Raw description text
 * @returns Normalized description
 */
export function normalizeDescription(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Generates a SHA-256 hash of transaction core data.
 *
 * Hash input format: "YYYY-MM-DD|amount_cents|normalized_description"
 *
 * @param date - ISO date string (YYYY-MM-DD)
 * @param amount - Amount in cents (integer)
 * @param description - Raw description text
 * @returns Promise<string> - Hex-encoded SHA-256 hash
 */
export async function generateFingerprint(
  date: string,
  amount: number,
  description: string
): Promise<string> {
  // Build hash input string
  const normalized = normalizeDescription(description);
  const hashInput = `${date}|${amount}|${normalized}`;

  // Convert string to bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(hashInput);

  // Generate SHA-256 hash
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);

  // Convert buffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Adds fingerprints to an array of staged transactions.
 *
 * @param transactions - Array of StagedTransactions (must be valid)
 * @returns Promise<StagedTransaction[]> - Same array with fingerprint property added
 */
export async function addFingerprints(
  transactions: StagedTransaction[]
): Promise<(StagedTransaction & { fingerprint: string })[]> {
  const withFingerprints = await Promise.all(
    transactions
      .filter((t) => t.isValid) // Only fingerprint valid transactions
      .map(async (t) => ({
        ...t,
        fingerprint: await generateFingerprint(t.date!, t.amount!, t.description!),
      }))
  );

  return withFingerprints;
}
