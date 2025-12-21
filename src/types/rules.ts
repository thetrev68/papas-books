import { Rule } from './database';

export type MatchType = 'contains' | 'exact' | 'startsWith' | 'regex';

export interface InsertRule {
  booksetId: string;
  keyword: string;
  matchType: MatchType;
  caseSensitive: boolean;
  targetCategoryId: string;
  suggestedPayee?: string;
  priority: number;
  isEnabled: boolean;
}

export type UpdateRule = Partial<Omit<InsertRule, 'booksetId'>>;

export interface RuleMatch {
  rule: Rule;
  matchedText: string; // The portion of description that matched
  confidence: number; // 0-100 (100 = exact match, lower for partial matches)
}

export interface RuleApplicationResult {
  transactionId: string;
  applied: boolean; // True if rule was applied
  matchedRule?: Rule; // The rule that was applied
  reason?: string; // Why it wasn't applied (if applicable)
  previousCategoryId?: string; // For undo functionality (future)
}

export interface RuleBatchResult {
  totalTransactions: number;
  appliedCount: number;
  skippedCount: number;
  errorCount: number;
  results: RuleApplicationResult[];
}
