import { validateRegex, insertRuleSchema } from './rules';

describe('validateRegex', () => {
  describe('Valid patterns', () => {
    it('should validate simple patterns', () => {
      expect(validateRegex('target')).toEqual({ valid: true });
      expect(validateRegex('walmart|target')).toEqual({ valid: true });
    });

    it('should validate character classes', () => {
      expect(validateRegex('[0-9]+')).toEqual({ valid: true });
      expect(validateRegex('[A-Za-z]+')).toEqual({ valid: true });
    });

    it('should validate anchors and quantifiers', () => {
      expect(validateRegex('^TARGET')).toEqual({ valid: true });
      expect(validateRegex('STORE$')).toEqual({ valid: true });
      expect(validateRegex('\\d{2,4}')).toEqual({ valid: true });
    });
  });

  describe('Invalid patterns - Syntax errors', () => {
    it('should reject syntactically invalid patterns', () => {
      const result = validateRegex('[invalid(');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject unclosed groups', () => {
      expect(validateRegex('(unclosed').valid).toBe(false);
      expect(validateRegex('[unclosed').valid).toBe(false);
    });
  });

  describe('Invalid patterns - ReDoS protection', () => {
    it('should reject nested quantifiers', () => {
      const result = validateRegex('(a+)+');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('nested quantifiers');
    });

    it('should reject various nested quantifier patterns', () => {
      expect(validateRegex('(a*)*').valid).toBe(false);
      expect(validateRegex('(a+)*').valid).toBe(false);
      expect(validateRegex('([a-z]+)+').valid).toBe(false);
    });

    it('should reject overly long patterns', () => {
      const longPattern = 'a'.repeat(600);
      const result = validateRegex(longPattern);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty patterns', () => {
      expect(validateRegex('')).toEqual({ valid: true });
    });

    it('should provide helpful error messages', () => {
      const result1 = validateRegex('(a+)+');
      expect(result1.error).toBeTruthy();
      expect(result1.error).toContain('nested quantifiers');

      const result2 = validateRegex('[invalid');
      expect(result2.error).toBeTruthy();
    });
  });
});

describe('insertRuleSchema', () => {
  const validRule = {
    booksetId: '123e4567-e89b-12d3-a456-426614174000',
    keyword: 'target',
    matchType: 'contains' as const,
    caseSensitive: false,
    targetCategoryId: '123e4567-e89b-12d3-a456-426614174001',
    priority: 50,
    isEnabled: true,
  };

  it('should validate a complete rule', () => {
    const result = insertRuleSchema.safeParse(validRule);
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { keyword, ...incomplete } = validRule;
    const result = insertRuleSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it('should reject invalid UUIDs', () => {
    const invalidUuid = { ...validRule, booksetId: 'not-a-uuid' };
    const result = insertRuleSchema.safeParse(invalidUuid);
    expect(result.success).toBe(false);
  });

  it('should accept optional suggested payee', () => {
    const withPayee = { ...validRule, suggestedPayee: 'Target Store' };
    const result = insertRuleSchema.safeParse(withPayee);
    expect(result.success).toBe(true);
  });

  it('should reject invalid priority values', () => {
    const tooLow = { ...validRule, priority: 0 };
    const tooHigh = { ...validRule, priority: 101 };

    expect(insertRuleSchema.safeParse(tooLow).success).toBe(false);
    expect(insertRuleSchema.safeParse(tooHigh).success).toBe(false);
  });

  it('should reject invalid match types', () => {
    const invalidMatchType = { ...validRule, matchType: 'invalid' };
    const result = insertRuleSchema.safeParse(invalidMatchType);
    expect(result.success).toBe(false);
  });
});
