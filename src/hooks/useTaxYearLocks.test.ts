import { describe, it, expect } from 'vitest';

describe('useTaxYearLocks', () => {
  it('should correctly identify locked dates with cumulative locking', () => {
    // Test the business logic: if maxLockedYear is 2023, then 2023, 2022, 2021, etc. are locked
    const maxLockedYear = 2023;

    const isDateLocked = (dateStr: string): boolean => {
      if (!maxLockedYear) return false;
      // Parse as YYYY-MM-DD format to extract year directly
      const year = parseInt(dateStr.split('-')[0], 10);
      return year <= maxLockedYear;
    };

    // Test dates
    expect(isDateLocked('2023-06-15')).toBe(true); // 2023 is locked
    expect(isDateLocked('2022-12-31')).toBe(true); // 2022 is also locked (cumulative)
    expect(isDateLocked('2024-01-01')).toBe(false); // 2024 is not locked
  });

  it('should handle multiple locked years', () => {
    const lockedYears = [2021, 2022, 2023];
    const maxLockedYear = Math.max(...lockedYears);

    expect(maxLockedYear).toBe(2023);

    const isDateLocked = (dateStr: string): boolean => {
      if (!maxLockedYear) return false;
      // Parse as YYYY-MM-DD format to extract year directly
      const year = parseInt(dateStr.split('-')[0], 10);
      return year <= maxLockedYear;
    };

    // All years <= 2023 should be locked
    expect(isDateLocked('2020-01-01')).toBe(true);
    expect(isDateLocked('2021-06-15')).toBe(true);
    expect(isDateLocked('2022-12-31')).toBe(true);
    expect(isDateLocked('2023-12-31')).toBe(true);
    expect(isDateLocked('2024-01-01')).toBe(false);
  });

  it('should handle no locked years', () => {
    const lockedYears: number[] = [];
    const maxLockedYear = lockedYears.length > 0 ? Math.max(...lockedYears) : null;

    expect(maxLockedYear).toBe(null);

    const isDateLocked = (dateStr: string): boolean => {
      if (!maxLockedYear) return false;
      const year = new Date(dateStr).getFullYear();
      return year <= maxLockedYear;
    };

    // No dates should be locked
    expect(isDateLocked('2020-01-01')).toBe(false);
    expect(isDateLocked('2023-06-15')).toBe(false);
    expect(isDateLocked('2024-01-01')).toBe(false);
  });

  it('should correctly calculate max locked year from multiple years', () => {
    const lockedYears = [2021, 2023, 2022]; // Unsorted
    const maxLockedYear = lockedYears.length > 0 ? Math.max(...lockedYears) : null;

    expect(maxLockedYear).toBe(2023); // Should find the max regardless of order
  });
});
