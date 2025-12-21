import { describe, it, expect } from 'vitest';
import { insertAccountSchema, updateAccountSchema } from './accounts';

describe('Account Validation', () => {
  const validAccount = {
    booksetId: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Account',
    type: 'Asset',
    openingBalance: 1000,
    openingBalanceDate: '2024-01-01',
  };

  it('validates a correct account', () => {
    const result = insertAccountSchema.safeParse(validAccount);
    expect(result.success).toBe(true);
  });

  it('fails with empty name', () => {
    const result = insertAccountSchema.safeParse({ ...validAccount, name: '' });
    expect(result.success).toBe(false);
  });

  it('fails with invalid type', () => {
    const result = insertAccountSchema.safeParse({ ...validAccount, type: 'Invalid' });
    expect(result.success).toBe(false);
  });

  it('fails with non-integer opening balance', () => {
    const result = insertAccountSchema.safeParse({ ...validAccount, openingBalance: 100.5 });
    expect(result.success).toBe(false);
  });

  it('fails with invalid date format', () => {
    const result = insertAccountSchema.safeParse({
      ...validAccount,
      openingBalanceDate: 'invalid-date',
    });
    expect(result.success).toBe(false);
  });

  it('allows partial updates', () => {
    const result = updateAccountSchema.safeParse({ name: 'Updated Name' });
    expect(result.success).toBe(true);
  });

  it('prevents updating booksetId', () => {
    const result = updateAccountSchema.safeParse({ booksetId: 'new-uuid' });
    // zod.omit strips the key, so safeParse will succeed but the output won't have booksetId
    // However, if we pass it to the parser, it just ignores it if it's not in the schema.
    // The key here is that the type UpdateAccount shouldn't have booksetId.
    expect(result.success).toBe(true);
    if (result.success) {
      // @ts-expect-error booksetId should not exist
      expect(result.data.booksetId).toBeUndefined();
    }
  });
});
