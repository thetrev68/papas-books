import { describe, it, expect } from 'vitest';
import { matchesRule, findMatchingRules, selectBestRule } from './matcher';
import { Rule } from '../../types/database';

describe('matchesRule', () => {
  it('should match "contains" rule', () => {
    const rule = {
      keyword: 'target',
      match_type: 'contains',
      case_sensitive: false,
    } as Rule;

    expect(matchesRule('TARGET STORE #1234', rule)).toBe(true);
    expect(matchesRule('WALMART', rule)).toBe(false);
  });

  it('should match "exact" rule', () => {
    const rule = {
      keyword: 'target',
      match_type: 'exact',
      case_sensitive: false,
    } as Rule;

    expect(matchesRule('target', rule)).toBe(true);
    expect(matchesRule('TARGET', rule)).toBe(true);
    expect(matchesRule('target store', rule)).toBe(false);
  });

  it('should match "startsWith" rule', () => {
    const rule = {
      keyword: 'debit card',
      match_type: 'startsWith',
      case_sensitive: false,
    } as Rule;

    expect(matchesRule('DEBIT CARD PURCHASE - TARGET', rule)).toBe(true);
    expect(matchesRule('PURCHASE - DEBIT CARD', rule)).toBe(false);
  });

  it('should match "regex" rule', () => {
    const rule = {
      keyword: 'target|walmart|costco',
      match_type: 'regex',
      case_sensitive: false,
    } as Rule;

    expect(matchesRule('TARGET STORE', rule)).toBe(true);
    expect(matchesRule('WALMART', rule)).toBe(true);
    expect(matchesRule('STARBUCKS', rule)).toBe(false);
  });

  it('should handle case sensitivity', () => {
    const rule = {
      keyword: 'Target',
      match_type: 'contains',
      case_sensitive: true,
    } as Rule;

    expect(matchesRule('Target Store', rule)).toBe(true);
    expect(matchesRule('TARGET STORE', rule)).toBe(false);
  });

  it('should handle invalid regex gracefully', () => {
    const rule = {
      keyword: '[invalid(regex',
      match_type: 'regex',
      case_sensitive: false,
      id: 'test-id', // needed for console error logging
    } as Rule;

    expect(matchesRule('any description', rule)).toBe(false);
  });
});

describe('findMatchingRules', () => {
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

    const matches = findMatchingRules('TARGET STORE', rules);

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

    const matches = findMatchingRules('TARGET STORE', rules);

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
