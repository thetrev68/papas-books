import { describe, it, expect } from 'vitest';
import { getSortedCategories } from './categoryUtils';
import type { Category } from '../types/database';

describe('getSortedCategories', () => {
  const createCategory = (overrides: Partial<Category>): Category => ({
    id: 'cat-1',
    bookset_id: 'bookset-1',
    name: 'Test Category',
    tax_line_item: null,
    is_tax_deductible: false,
    parent_category_id: null,
    sort_order: 0,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    is_archived: false,
    created_by: 'user-1',
    last_modified_by: 'user-1',
    ...overrides,
  });

  it('should return empty array for empty input', () => {
    const result = getSortedCategories([]);
    expect(result).toEqual([]);
  });

  it('should add displayName to categories without parent', () => {
    const categories = [createCategory({ id: 'cat-1', name: 'Office Supplies' })];
    const result = getSortedCategories(categories);

    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('Office Supplies');
  });

  it('should add full hierarchical displayName to child categories', () => {
    const categories = [
      createCategory({ id: 'parent', name: 'Auto & Travel', parent_category_id: null }),
      createCategory({ id: 'child', name: 'Fuel', parent_category_id: 'parent' }),
    ];
    const result = getSortedCategories(categories);

    const child = result.find((c) => c.id === 'child');
    expect(child?.displayName).toBe('Auto & Travel: Fuel');
  });

  it('should sort Income categories first', () => {
    const categories = [
      createCategory({ id: 'expense1', name: 'Office Supplies' }),
      createCategory({ id: 'income', name: 'Income' }),
      createCategory({ id: 'expense2', name: 'Auto' }),
    ];
    const result = getSortedCategories(categories);

    expect(result[0].id).toBe('income');
    expect(result[0].name).toBe('Income');
  });

  it('should sort non-Income categories alphabetically by display name', () => {
    const categories = [
      createCategory({ id: 'cat1', name: 'Utilities' }),
      createCategory({ id: 'cat2', name: 'Auto' }),
      createCategory({ id: 'cat3', name: 'Office' }),
    ];
    const result = getSortedCategories(categories);

    expect(result.map((c) => c.name)).toEqual(['Auto', 'Office', 'Utilities']);
  });

  it('should sort Income subcategories first, then other categories', () => {
    const categories = [
      createCategory({ id: 'expense', name: 'Expenses' }),
      createCategory({ id: 'income-parent', name: 'Income' }),
      createCategory({
        id: 'income-child',
        name: 'Consulting',
        parent_category_id: 'income-parent',
      }),
      createCategory({ id: 'expense-child', name: 'Supplies', parent_category_id: 'expense' }),
    ];
    const result = getSortedCategories(categories);

    // Income parent should be first
    expect(result[0].id).toBe('income-parent');
    // Income child should be second (child of Income root)
    expect(result[1].id).toBe('income-child');
    // Then other categories alphabetically
    expect(result[2].id).toBe('expense');
    expect(result[3].id).toBe('expense-child');
  });

  it('should handle circular references safely', () => {
    const categories = [
      createCategory({ id: 'cat1', name: 'Category 1', parent_category_id: 'cat2' }),
      createCategory({ id: 'cat2', name: 'Category 2', parent_category_id: 'cat1' }),
    ];

    // Should not throw or infinite loop
    const result = getSortedCategories(categories);
    expect(result).toHaveLength(2);
  });

  it('should handle missing parent categories gracefully', () => {
    const categories = [
      createCategory({ id: 'child', name: 'Orphan', parent_category_id: 'non-existent' }),
    ];

    const result = getSortedCategories(categories);
    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('Orphan');
  });

  it('should sort child categories by full hierarchical name', () => {
    const categories = [
      createCategory({ id: 'parent1', name: 'Zebra' }),
      createCategory({ id: 'parent2', name: 'Apple' }),
      createCategory({ id: 'child1', name: 'Child A', parent_category_id: 'parent1' }),
      createCategory({ id: 'child2', name: 'Child B', parent_category_id: 'parent2' }),
    ];

    const result = getSortedCategories(categories);

    // Should sort by display name: "Apple", "Apple: Child B", "Zebra", "Zebra: Child A"
    expect(result.map((c) => c.displayName)).toEqual([
      'Apple',
      'Apple: Child B',
      'Zebra',
      'Zebra: Child A',
    ]);
  });

  it('should not mutate original categories array', () => {
    const categories = [
      createCategory({ id: 'cat1', name: 'Category 1' }),
      createCategory({ id: 'cat2', name: 'Category 2' }),
    ];
    const original = [...categories];

    getSortedCategories(categories);

    expect(categories).toEqual(original);
  });

  it('should handle deeply nested hierarchies', () => {
    const categories = [
      createCategory({ id: 'root', name: 'Root' }),
      createCategory({ id: 'level1', name: 'Level 1', parent_category_id: 'root' }),
      createCategory({ id: 'level2', name: 'Level 2', parent_category_id: 'level1' }),
    ];

    const result = getSortedCategories(categories);

    const level2 = result.find((c) => c.id === 'level2');
    // Only shows immediate parent in display name
    expect(level2?.displayName).toBe('Level 1: Level 2');
  });

  it('should identify Income root even through multiple levels', () => {
    const categories = [
      createCategory({ id: 'income-root', name: 'Income' }),
      createCategory({ id: 'income-l1', name: 'Services', parent_category_id: 'income-root' }),
      createCategory({
        id: 'income-l2',
        name: 'Consulting',
        parent_category_id: 'income-l1',
      }),
      createCategory({ id: 'expense', name: 'Office' }),
    ];

    const result = getSortedCategories(categories);

    // All Income hierarchy should come before Expense
    const incomeIndices = [
      result.findIndex((c) => c.id === 'income-root'),
      result.findIndex((c) => c.id === 'income-l1'),
      result.findIndex((c) => c.id === 'income-l2'),
    ];
    const expenseIndex = result.findIndex((c) => c.id === 'expense');

    incomeIndices.forEach((index) => {
      expect(index).toBeLessThan(expenseIndex);
    });
  });
});
