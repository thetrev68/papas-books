import { insertRuleSchema, validateRegex } from './rules';

describe('validation/rules', () => {
  describe('insertRuleSchema', () => {
    const validRule = {
      booksetId: '123e4567-e89b-12d3-a456-426614174000',
      keyword: 'amazon',
      matchType: 'contains' as const,
      caseSensitive: false,
      targetCategoryId: '123e4567-e89b-12d3-a456-426614174001',
      priority: 50,
      isEnabled: true,
    };

    it('validates a valid rule', () => {
      const result = insertRuleSchema.safeParse(validRule);
      expect(result.success).toBe(true);
    });

    it('validates rule with optional suggestedPayee', () => {
      const ruleWithPayee = {
        ...validRule,
        suggestedPayee: 'Amazon.com',
      };
      const result = insertRuleSchema.safeParse(ruleWithPayee);
      expect(result.success).toBe(true);
    });

    it('rejects invalid booksetId', () => {
      const invalidRule = { ...validRule, booksetId: 'not-a-uuid' };
      const result = insertRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it('rejects empty keyword', () => {
      const invalidRule = { ...validRule, keyword: '' };
      const result = insertRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Keyword is required');
      }
    });

    it('rejects keyword longer than 200 characters', () => {
      const invalidRule = { ...validRule, keyword: 'a'.repeat(201) };
      const result = insertRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it('rejects invalid matchType', () => {
      const invalidRule = { ...validRule, matchType: 'invalid' };
      const result = insertRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it('validates all matchType options', () => {
      const matchTypes = ['contains', 'exact', 'startsWith', 'regex'] as const;
      matchTypes.forEach((matchType) => {
        const rule = { ...validRule, matchType };
        const result = insertRuleSchema.safeParse(rule);
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid targetCategoryId', () => {
      const invalidRule = { ...validRule, targetCategoryId: 'not-a-uuid' };
      const result = insertRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Category is required');
      }
    });

    it('rejects priority less than 1', () => {
      const invalidRule = { ...validRule, priority: 0 };
      const result = insertRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it('rejects priority greater than 100', () => {
      const invalidRule = { ...validRule, priority: 101 };
      const result = insertRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it('rejects non-integer priority', () => {
      const invalidRule = { ...validRule, priority: 50.5 };
      const result = insertRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it('rejects suggestedPayee longer than max length', () => {
      const invalidRule = { ...validRule, suggestedPayee: 'a'.repeat(256) };
      const result = insertRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it('rejects missing required fields', () => {
      const invalidRule = { keyword: 'test' };
      const result = insertRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });
  });

  describe('validateRegex', () => {
    it('validates valid regex patterns', () => {
      const validPatterns = [
        '^amazon',
        'walmart$',
        'starbucks.*coffee',
        '[0-9]{3}-[0-9]{2}-[0-9]{4}',
        '(cat|dog)',
        '\\d+\\.\\d{2}',
      ];

      validPatterns.forEach((pattern) => {
        const result = validateRegex(pattern);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('rejects invalid regex patterns', () => {
      const invalidPatterns = [
        '[invalid(regex',
        '(unclosed group',
        '[unclosed bracket',
        '*invalid',
        '(?P<invalid>python)',
      ];

      invalidPatterns.forEach((pattern) => {
        const result = validateRegex(pattern);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('handles empty string as valid regex', () => {
      const result = validateRegex('');
      expect(result.valid).toBe(true);
    });

    it('returns error message for invalid patterns', () => {
      const result = validateRegex('[invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unterminated character class');
    });

    it('handles non-Error objects thrown during regex validation', () => {
      const originalRegExp = global.RegExp;
      global.RegExp = vi.fn(() => {
        throw 'String Error';
      }) as unknown as typeof RegExp;

      const result = validateRegex('foo');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid regex pattern');

      global.RegExp = originalRegExp;
    });
  });
});
