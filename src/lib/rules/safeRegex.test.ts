import { safeRegexTest, validateRegexPattern } from './safeRegex';

describe('safeRegexTest', () => {
  describe('Basic regex matching', () => {
    it('should match simple patterns', () => {
      expect(safeRegexTest('target', 'TARGET STORE', 'i')).toBe(true);
      expect(safeRegexTest('target', 'WALMART', 'i')).toBe(false);
    });

    it('should handle alternation patterns', () => {
      expect(safeRegexTest('target|walmart|costco', 'TARGET STORE', 'i')).toBe(true);
      expect(safeRegexTest('target|walmart|costco', 'COSTCO', 'i')).toBe(true);
      expect(safeRegexTest('target|walmart|costco', 'STARBUCKS', 'i')).toBe(false);
    });

    it('should handle character classes', () => {
      expect(safeRegexTest('[0-9]{4}', 'Store #1234', 'i')).toBe(true);
      expect(safeRegexTest('[A-Z]+', 'TARGET', '')).toBe(true);
      expect(safeRegexTest('[a-z]+', 'TARGET', '')).toBe(false);
    });

    it('should handle anchors', () => {
      expect(safeRegexTest('^TARGET', 'TARGET STORE', 'i')).toBe(true);
      expect(safeRegexTest('^TARGET', 'STORE TARGET', 'i')).toBe(false);
      expect(safeRegexTest('STORE$', 'TARGET STORE', 'i')).toBe(true);
      expect(safeRegexTest('STORE$', 'STORE TARGET', 'i')).toBe(false);
    });
  });

  describe('Pattern complexity validation', () => {
    it('should reject nested quantifiers', () => {
      // These patterns can cause catastrophic backtracking
      expect(safeRegexTest('(a+)+', 'aaaaaaaaaaaaaaaa', '')).toBe(false);
      expect(safeRegexTest('(a*)*', 'aaaaaaaaaaaaaaaa', '')).toBe(false);
      expect(safeRegexTest('(a+)*', 'aaaaaaaaaaaaaaaa', '')).toBe(false);
      expect(safeRegexTest('(a{1,5})+', 'aaaaaaaaaaaaaaaa', '')).toBe(false);
      expect(safeRegexTest('([a-z]+)+', 'aaaaaaaaaaaaaaaa', '')).toBe(false);
    });

    it('should reject overly long patterns', () => {
      const longPattern = 'a'.repeat(600);
      expect(safeRegexTest(longPattern, 'test', '')).toBe(false);
    });

    it('should accept safe quantifiers', () => {
      // These are safe patterns
      expect(safeRegexTest('a+', 'aaaaaaa', '')).toBe(true);
      expect(safeRegexTest('(target)+', 'targettarget', 'i')).toBe(true);
      expect(safeRegexTest('[0-9]+', '12345', '')).toBe(true);
      expect(safeRegexTest('\\d{1,4}', '1234', '')).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid regex patterns gracefully', () => {
      expect(safeRegexTest('[invalid(regex', 'any text', '')).toBe(false);
      expect(safeRegexTest('(unclosed group', 'any text', '')).toBe(false);
      expect(safeRegexTest('[unclosed', 'any text', '')).toBe(false);
      expect(safeRegexTest('(?invalid)', 'any text', '')).toBe(false);
    });

    it('should not throw errors for any input', () => {
      expect(() => safeRegexTest('***', 'test', '')).not.toThrow();
      expect(() => safeRegexTest('???', 'test', '')).not.toThrow();
      expect(() => safeRegexTest('\\', 'test', '')).not.toThrow();
    });
  });

  describe('Case sensitivity', () => {
    it('should respect case-insensitive flag', () => {
      expect(safeRegexTest('target', 'TARGET', 'i')).toBe(true);
      expect(safeRegexTest('target', 'TARGET', '')).toBe(false);
    });

    it('should work without flags', () => {
      expect(safeRegexTest('TARGET', 'TARGET STORE', '')).toBe(true);
      expect(safeRegexTest('target', 'TARGET STORE', '')).toBe(false);
    });
  });

  describe('Real-world patterns', () => {
    it('should handle common bank transaction patterns', () => {
      // ACH transfer patterns
      expect(safeRegexTest('ACH.*TRANSFER', 'ACH ELECTRONIC TRANSFER', 'i')).toBe(true);

      // Card purchase patterns
      expect(safeRegexTest('DEBIT CARD \\d+', 'DEBIT CARD 1234 PURCHASE', 'i')).toBe(true);

      // Check patterns
      expect(safeRegexTest('CHECK #?\\d+', 'CHECK #1001', 'i')).toBe(true);
      expect(safeRegexTest('CHECK #?\\d+', 'CHECK 1001', 'i')).toBe(true);

      // Multiple merchants
      expect(safeRegexTest('(TARGET|WALMART|COSTCO).*#\\d+', 'TARGET STORE #1234', 'i')).toBe(true);
    });

    it('should handle whitespace in patterns', () => {
      expect(safeRegexTest('DEBIT\\s+CARD', 'DEBIT CARD PURCHASE', 'i')).toBe(true);
      expect(safeRegexTest('DEBIT\\s+CARD', 'DEBIT    CARD PURCHASE', 'i')).toBe(true);
    });
  });
});

describe('validateRegexPattern', () => {
  describe('Valid patterns', () => {
    it('should validate simple patterns', () => {
      const result = validateRegexPattern('target');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate complex safe patterns', () => {
      expect(validateRegexPattern('target|walmart|costco').isValid).toBe(true);
      expect(validateRegexPattern('^DEBIT CARD \\d+$').isValid).toBe(true);
      expect(validateRegexPattern('[A-Z]{2,10}').isValid).toBe(true);
      expect(validateRegexPattern('\\d{4}-\\d{2}-\\d{2}').isValid).toBe(true);
    });
  });

  describe('Invalid patterns', () => {
    it('should reject nested quantifiers', () => {
      const result = validateRegexPattern('(a+)+');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('nested quantifiers');
    });

    it('should reject overly long patterns', () => {
      const longPattern = 'a'.repeat(600);
      const result = validateRegexPattern(longPattern);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject syntactically invalid patterns', () => {
      const result = validateRegexPattern('[invalid(');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject unclosed groups', () => {
      expect(validateRegexPattern('(unclosed').isValid).toBe(false);
      expect(validateRegexPattern('[unclosed').isValid).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty patterns', () => {
      const result = validateRegexPattern('');
      expect(result.isValid).toBe(true);
    });

    it('should provide helpful error messages', () => {
      const result1 = validateRegexPattern('(a+)+');
      expect(result1.error).toContain('nested quantifiers');

      const result2 = validateRegexPattern('[invalid');
      expect(result2.error).toBeTruthy();

      const result3 = validateRegexPattern('a'.repeat(600));
      expect(result3.error).toContain('too long');
    });
  });
});
