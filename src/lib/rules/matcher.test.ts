import { matchesRule, findMatchingRules, selectBestRule } from './matcher';
import { Rule } from '../../types/rules';
import { Transaction } from '../../types/database';

describe('matchesRule', () => {
  const dummyAmount = 1000;
  const dummyDate = new Date('2023-01-15');

  it('should match "contains" rule', () => {
    const rule = {
      keyword: 'target',
      match_type: 'contains',
      case_sensitive: false,
    } as Rule;

    expect(matchesRule('TARGET STORE #1234', dummyAmount, dummyDate, rule)).toBe(true);
    expect(matchesRule('WALMART', dummyAmount, dummyDate, rule)).toBe(false);
  });

  it('should match "exact" rule', () => {
    const rule = {
      keyword: 'target',
      match_type: 'exact',
      case_sensitive: false,
    } as Rule;

    expect(matchesRule('target', dummyAmount, dummyDate, rule)).toBe(true);
    expect(matchesRule('TARGET', dummyAmount, dummyDate, rule)).toBe(true);
    expect(matchesRule('target store', dummyAmount, dummyDate, rule)).toBe(false);
  });

  it('should match "startsWith" rule', () => {
    const rule = {
      keyword: 'debit card',
      match_type: 'startsWith',
      case_sensitive: false,
    } as Rule;

    expect(matchesRule('DEBIT CARD PURCHASE - TARGET', dummyAmount, dummyDate, rule)).toBe(true);
    expect(matchesRule('PURCHASE - DEBIT CARD', dummyAmount, dummyDate, rule)).toBe(false);
  });

  it('should match "regex" rule', () => {
    const rule = {
      keyword: 'target|walmart|costco',
      match_type: 'regex',
      case_sensitive: false,
    } as Rule;

    expect(matchesRule('TARGET STORE', dummyAmount, dummyDate, rule)).toBe(true);
    expect(matchesRule('WALMART', dummyAmount, dummyDate, rule)).toBe(true);
    expect(matchesRule('STARBUCKS', dummyAmount, dummyDate, rule)).toBe(false);
  });

  it('should handle case sensitivity', () => {
    const rule = {
      keyword: 'Target',
      match_type: 'contains',
      case_sensitive: true,
    } as Rule;

    expect(matchesRule('Target Store', dummyAmount, dummyDate, rule)).toBe(true);
    expect(matchesRule('TARGET STORE', dummyAmount, dummyDate, rule)).toBe(false);
  });

  it('should handle invalid regex gracefully', () => {
    const rule = {
      keyword: '[invalid(regex',
      match_type: 'regex',
      case_sensitive: false,
      id: 'test-id', // needed for console error logging
    } as Rule;

    expect(matchesRule('any description', dummyAmount, dummyDate, rule)).toBe(false);
  });

  describe('Advanced Conditions', () => {
    const basicRule = {
      keyword: 'target',
      match_type: 'contains',
      case_sensitive: false,
    } as Rule;

    it('should respect amount min/max', () => {
      const rule = {
        ...basicRule,
        conditions: { amountMin: 1000, amountMax: 2000 },
      } as Rule;

      expect(matchesRule('TARGET', 1500, dummyDate, rule)).toBe(true); // Inside range
      expect(matchesRule('TARGET', 500, dummyDate, rule)).toBe(false); // Too low
      expect(matchesRule('TARGET', 2500, dummyDate, rule)).toBe(false); // Too high
      expect(matchesRule('TARGET', -1500, dummyDate, rule)).toBe(true); // Absolute value check
    });

    it('should respect date range (months)', () => {
      const rule = {
        ...basicRule,
        conditions: { dateRange: { startMonth: 6, endMonth: 8 } },
      } as Rule;

      expect(matchesRule('TARGET', 1000, new Date('2023-07-15'), rule)).toBe(true); // July
      expect(matchesRule('TARGET', 1000, new Date('2023-05-15'), rule)).toBe(false); // May
      expect(matchesRule('TARGET', 1000, new Date('2023-09-15'), rule)).toBe(false); // Sept
    });

    it('should respect date range (days)', () => {
      const rule = {
        ...basicRule,
        conditions: { dateRange: { startDay: 10, endDay: 20 } },
      } as Rule;

      expect(matchesRule('TARGET', 1000, new Date('2023-01-15'), rule)).toBe(true);
      expect(matchesRule('TARGET', 1000, new Date('2023-01-05'), rule)).toBe(false);
      expect(matchesRule('TARGET', 1000, new Date('2023-01-25'), rule)).toBe(false);
    });

    it('should respect description regex condition', () => {
      const rule = {
        ...basicRule, // matches 'target'
        conditions: { descriptionRegex: 'store' }, // AND must match /store/i
      } as Rule;

      expect(matchesRule('TARGET STORE', 1000, dummyDate, rule)).toBe(true);
      expect(matchesRule('TARGET ONLINE', 1000, dummyDate, rule)).toBe(false);
    });
  });
});

describe('findMatchingRules', () => {
  const txn = {
    original_description: 'TARGET STORE',
    amount: 1000,
    date: '2023-01-15',
  } as Transaction;

  it('should find all matching rules', () => {
    const rules = [
      {
        id: '1',
        keyword: 'target',
        match_type: 'contains',
        is_enabled: true,
        priority: 10,
      } as Rule,
      { id: '2', keyword: 'store', match_type: 'contains', is_enabled: true, priority: 20 } as Rule,
      {
        id: '3',
        keyword: 'walmart',
        match_type: 'contains',
        is_enabled: true,
        priority: 30,
      } as Rule,
    ];

    const matches = findMatchingRules(txn, rules);

    expect(matches).toHaveLength(2);
    expect(matches[0].rule.id).toBe('2'); // Higher priority first
    expect(matches[1].rule.id).toBe('1');
  });

  it('should skip disabled rules', () => {
    const rules = [
      {
        id: '1',
        keyword: 'target',
        match_type: 'contains',
        is_enabled: false,
        priority: 10,
      } as Rule,
      { id: '2', keyword: 'store', match_type: 'contains', is_enabled: true, priority: 20 } as Rule,
    ];

    const matches = findMatchingRules(txn, rules);

    expect(matches).toHaveLength(1);
    expect(matches[0].rule.id).toBe('2');
  });
});

describe('selectBestRule', () => {
  it('should return highest priority rule', () => {
    const rules = [
      {
        id: '1',
        keyword: 'target',
        match_type: 'contains',
        is_enabled: true,
        priority: 10,
      } as Rule,
      { id: '2', keyword: 'store', match_type: 'contains', is_enabled: true, priority: 20 } as Rule,
    ];

    // Manually construct what findMatchingRules returns (sorted)
    const matches = [
      { rule: rules[1], matchedText: 'store', confidence: 100 },
      { rule: rules[0], matchedText: 'target', confidence: 100 },
    ];

    const best = selectBestRule(matches);
    expect(best?.id).toBe('2');
  });

  it('should return null for empty matches', () => {
    expect(selectBestRule([])).toBeNull();
  });
});
