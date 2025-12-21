import { Rule } from '../../types/database';
import { RuleMatch } from '../../types/rules';

export interface MatchOptions {
  caseSensitive?: boolean; // Override rule's caseSensitive flag (for testing)
}

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
export function normalizeText(text: string, caseSensitive: boolean): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return caseSensitive ? normalized : normalized.toLowerCase();
}

/**
 * Tests if a transaction description matches a rule.
 *
 * Supports four match types:
 * - 'contains': Keyword appears anywhere in description
 * - 'exact': Description equals keyword exactly
 * - 'startsWith': Description begins with keyword
 * - 'regex': Keyword is a regular expression pattern
 *
 * @param description - Transaction's originalDescription
 * @param rule - Rule to test against
 * @returns True if rule matches
 */
export function matchesRule(description: string, rule: Rule): boolean {
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

    case 'regex':
      try {
        const flags = rule.case_sensitive ? '' : 'i';
        const regex = new RegExp(rule.keyword, flags);
        return regex.test(description); // Use original description for regex
      } catch (error) {
        // Invalid regex - treat as no match
        console.error(`Invalid regex in rule ${rule.id}:`, error);
        return false;
      }

    default:
      return false;
  }
}

/**
 * Finds all rules that match a description.
 *
 * Filters out:
 * - Disabled rules (isEnabled = false)
 * - Rules that don't match the description
 *
 * Returns:
 * - Sorted by priority (highest first)
 * - Includes confidence score (100 for all matches in Phase 4)
 *
 * @param description - Transaction's originalDescription
 * @param rules - Array of all rules
 * @returns Array of matching rules, sorted by priority
 */
export function findMatchingRules(description: string, rules: Rule[]): RuleMatch[] {
  const matches: RuleMatch[] = [];

  for (const rule of rules) {
    // Skip disabled rules
    if (!rule.is_enabled) {
      continue;
    }

    // Test if rule matches
    if (matchesRule(description, rule)) {
      matches.push({
        rule,
        matchedText: rule.keyword, // Simplified for Phase 4
        confidence: 100, // All matches are 100% confidence in Phase 4
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
export function selectBestRule(matches: RuleMatch[]): Rule | null {
  if (matches.length === 0) {
    return null;
  }

  // Return highest priority rule (first in sorted array)
  return matches[0].rule;
}
