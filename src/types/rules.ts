import { Rule as DBRule } from './database';

export interface RuleConditions {
  amountMin?: number; // cents
  amountMax?: number; // cents
  dateRange?: {
    startMonth?: number; // 1-12
    endMonth?: number; // 1-12
    startDay?: number; // 1-31
    endDay?: number; // 1-31
  };
  descriptionRegex?: string;
}

export interface Rule extends Omit<DBRule, 'conditions'> {
  conditions?: RuleConditions;
}

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
  conditions?: RuleConditions;
}

export type UpdateRule = Partial<Omit<InsertRule, 'booksetId'>> & {
  updatedAt?: string; // For optimistic locking
};

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
  previousCategoryId?: string | null; // For undo functionality (future)
}

export interface RuleBatchResult {
  totalTransactions: number;
  appliedCount: number;
  skippedCount: number;
  errorCount: number;
  results: RuleApplicationResult[];
}
