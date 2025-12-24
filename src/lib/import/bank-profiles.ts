import type { CsvMapping } from '../../types/import';

const BANK_PROFILES: Record<string, CsvMapping> = {
  CHASE_CHECKING: {
    dateColumn: 'Posting Date',
    amountColumn: 'Amount',
    descriptionColumn: 'Description',
    dateFormat: 'MM/dd/yyyy',
    hasHeaderRow: true,
    amountMode: 'signed',
  },

  AMEX: {
    dateColumn: 'Date',
    amountColumn: '',
    descriptionColumn: 'Description',
    dateFormat: 'MM/dd/yyyy',
    hasHeaderRow: true,
    amountMode: 'separate',
    inflowColumn: 'Credits',
    outflowColumn: 'Charges',
  },

  BANK_OF_AMERICA: {
    dateColumn: 'Date',
    amountColumn: 'Amount',
    descriptionColumn: 'Description',
    dateFormat: 'MM/dd/yyyy',
    hasHeaderRow: true,
    amountMode: 'signed',
  },

  WELLS_FARGO: {
    dateColumn: 'Date',
    amountColumn: 'Amount',
    descriptionColumn: 'Description',
    dateFormat: 'MM/dd/yyyy',
    hasHeaderRow: true,
    amountMode: 'signed',
  },
};

/**
 * Gets a bank profile by name.
 *
 * @param bankName - Bank profile identifier
 * @returns CsvMapping or undefined
 */
export function getBankProfile(bankName: string): CsvMapping | undefined {
  return BANK_PROFILES[bankName];
}

/**
 * Lists all available bank profiles.
 *
 * @returns Array of bank names
 */
export function listBankProfiles(): string[] {
  return Object.keys(BANK_PROFILES);
}
