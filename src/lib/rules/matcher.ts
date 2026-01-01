import { Transaction } from '../../types/database';
import { RuleMatch, Rule as AppRule } from '../../types/rules';
import { safeRegexTest } from './safeRegex';

/**
 * Normalizes text for matching.
 *
 * Rules:
 * - Trim leading/trailing whitespace
 * - Convert to lowercase if case-insensitive
 * - Replace multiple spaces with single space
 *
 * @param text - Raw text to normalize
 * @param caseSensitive - Whether to preserve case
 * @returns Normalized string
 */
function normalizeText(text: string, caseSensitive: boolean): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return caseSensitive ? normalized : normalized.toLowerCase();
}

/**
 * Tests if a description matches the basic keyword/regex criteria of a rule.
 */
function basicMatch(description: string, rule: AppRule): boolean {
  // Normalize both description and keyword
  const normalizedDescription = normalizeText(description, rule.case_sensitive);
  const normalizedKeyword = normalizeText(rule.keyword, rule.case_sensitive);

  switch (rule.match_type) {
    case 'contains':
      return normalizedDescription.includes(normalizedKeyword);

    case 'exact':
      return normalizedDescription === normalizedKeyword;

    case 'startsWith':
      return normalizedDescription.startsWith(normalizedKeyword);

    case 'regex': {
      // Use safe regex execution to prevent ReDoS attacks
      const flags = rule.case_sensitive ? '' : 'i';
      return safeRegexTest(rule.keyword, description, flags);
    }

    default:
      return false;
  }
}

/**
 * Tests if a transaction matches a rule, including advanced conditions.
 *
 * @param description - Transaction's originalDescription
 * @param amount - Transaction amount in cents
 * @param date - Transaction date object
 * @param rule - Rule to test against
 * @returns True if rule matches
 */
export function matchesRule(
  description: string,
  amount: number,
  date: Date,
  rule: AppRule
): boolean {
  if (!basicMatch(description, rule)) return false;

  if (rule.conditions) {
    const { amountMin, amountMax, dateRange, descriptionRegex } = rule.conditions;
    const absAmount = Math.abs(amount);

    if (amountMin !== undefined && absAmount < amountMin) return false;
    if (amountMax !== undefined && absAmount > amountMax) return false;

    if (descriptionRegex) {
      // Use safe regex execution for advanced conditions
      if (!safeRegexTest(descriptionRegex, description, 'i')) return false;
    }

    if (dateRange) {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      if (dateRange.startMonth && month < dateRange.startMonth) return false;
      if (dateRange.endMonth && month > dateRange.endMonth) return false;
      if (dateRange.startDay && day < dateRange.startDay) return false;
      if (dateRange.endDay && day > dateRange.endDay) return false;
    }
  }

  return true;
}

/**
 * Finds all rules that match a transaction.
 *
 * Filters out:
 * - Disabled rules (isEnabled = false)
 * - Rules that don't match the transaction
 *
 * Returns:
 * - Sorted by priority (highest first)
 * - Includes confidence score (100 for all matches in Phase 4)
 *
 * @param transaction - Transaction to test
 * @param rules - Array of all rules
 * @returns Array of matching rules, sorted by priority
 */
export function findMatchingRules(transaction: Transaction, rules: AppRule[]): RuleMatch[] {
  const matches: RuleMatch[] = [];
  const date = new Date(transaction.date);

  for (const rule of rules) {
    // Skip disabled rules
    if (!rule.is_enabled) {
      continue;
    }

    // Test if rule matches
    if (matchesRule(transaction.original_description, transaction.amount, date, rule)) {
      matches.push({
        rule,
        matchedText: rule.keyword, // Simplified
        confidence: 100, // All matches are 100% confidence
      });
    }
  }

  // Sort by priority (highest first)
  matches.sort((a, b) => b.rule.priority - a.rule.priority);

  return matches;
}

/**
 * Selects the best rule from multiple matches.
 *
 * Logic:
 * - Returns the first rule (highest priority)
 * - Returns null if no matches
 *
 * Future enhancement: Consider confidence scores, specificity, etc.
 *
 * @param matches - Array of matching rules (sorted by priority)
 * @returns The winning rule, or null
 */
export function selectBestRule(matches: RuleMatch[]): AppRule | null {
  if (matches.length === 0) {
    return null;
  }

  // Return highest priority rule (first in sorted array)
  return matches[0].rule;
}
