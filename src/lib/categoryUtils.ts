import { useMemo } from 'react';
import type { Category } from '../types/database';
import { useCategories } from '../hooks/useCategories';

export interface CategoryWithDisplayName extends Category {
  displayName: string;
}

/**
 * Sorts categories with Income first, then alphabetically by full name (Parent: Child).
 * Adds a displayName property to each category with the full hierarchical name.
 */
export function getSortedCategories(categories: Category[]): CategoryWithDisplayName[] {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const getRoot = (cat: Category): Category => {
    let current = cat;
    const seen = new Set<string>();
    while (current.parent_category_id && categoryMap.has(current.parent_category_id)) {
      if (seen.has(current.id)) break;
      seen.add(current.id);
      current = categoryMap.get(current.parent_category_id)!;
    }
    return current;
  };

  const getFullName = (cat: Category) => {
    if (!cat.parent_category_id) return cat.name;
    const parent = categoryMap.get(cat.parent_category_id);
    return parent ? `${parent.name}: ${cat.name}` : cat.name;
  };

  return [...categories]
    .sort((a, b) => {
      const rootA = getRoot(a);
      const rootB = getRoot(b);
      const isIncomeA = rootA.name === 'Income';
      const isIncomeB = rootB.name === 'Income';

      if (isIncomeA && !isIncomeB) return -1;
      if (!isIncomeA && isIncomeB) return 1;

      return getFullName(a).localeCompare(getFullName(b));
    })
    .map((cat) => ({
      ...cat,
      displayName: getFullName(cat),
    }));
}

/**
 * Hook that returns sorted categories from the current context.
 * Categories are sorted with Income first, then alphabetically by full name.
 */
export function useSortedCategories(): CategoryWithDisplayName[] {
  const { categories } = useCategories();
  return useMemo(() => getSortedCategories(categories), [categories]);
}
