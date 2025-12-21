import { describe, it, expect } from 'vitest';
import { insertCategorySchema, updateCategorySchema } from './categories';

describe('Category Validation', () => {
  const validCategory = {
    booksetId: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Category',
    isTaxDeductible: false,
    taxLineItem: 'Schedule C',
    parentCategoryId: null,
    sortOrder: 0,
  };

  it('validates a correct category', () => {
    const result = insertCategorySchema.safeParse(validCategory);
    expect(result.success).toBe(true);
  });

  it('fails with empty name', () => {
    const result = insertCategorySchema.safeParse({ ...validCategory, name: '' });
    expect(result.success).toBe(false);
  });

  it('validates optional fields', () => {
    const result = insertCategorySchema.safeParse({
      booksetId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Minimal Category',
      isTaxDeductible: true,
    });
    expect(result.success).toBe(true);
  });

  it('fails with invalid uuid for parentCategoryId', () => {
    const result = insertCategorySchema.safeParse({
      ...validCategory,
      parentCategoryId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('allows partial updates', () => {
    const result = updateCategorySchema.safeParse({ name: 'Updated Name' });
    expect(result.success).toBe(true);
  });
});
