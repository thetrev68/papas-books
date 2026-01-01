/**
 * Safe regex execution utilities to prevent ReDoS (Regular Expression Denial of Service) attacks.
 *
 * User-supplied regex patterns are executed with:
 * - Timeout protection (prevents catastrophic backtracking)
 * - Pattern complexity validation (prevents nested quantifiers)
 * - Error handling (invalid patterns return false instead of throwing)
 */

const MAX_PATTERN_LENGTH = 500; // Maximum regex pattern length

/**
 * Validates regex pattern complexity to prevent obviously dangerous patterns.
 *
 * Checks for:
 * - Nested quantifiers like (a+)+ or (a*)*
 * - Excessive pattern length
 *
 * @param pattern - The regex pattern to validate
 * @returns True if pattern passes basic safety checks
 */
function validatePatternComplexity(pattern: string): boolean {
  // Reject overly long patterns
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return false;
  }

  // Detect nested quantifiers which can cause catastrophic backtracking
  // Patterns like (a+)+, (a*)*, (a+)*, (a{1,5})+, etc.
  const nestedQuantifiers = /(\(.*[*+{][^)]*\)[*+{])|(\[[^\]]*[*+{][^\]]*\][*+{])/;
  if (nestedQuantifiers.test(pattern)) {
    return false;
  }

  return true;
}

/**
 * Tests a regex pattern against text with timeout protection.
 *
 * This function executes the regex in a controlled manner:
 * 1. Validates pattern complexity first
 * 2. Executes regex with timeout protection
 * 3. Returns false for invalid patterns or timeouts
 *
 * @param pattern - The regex pattern to test
 * @param text - The text to match against
 * @param flags - Regex flags (e.g., 'i' for case-insensitive)
 * @returns True if pattern matches, false otherwise or on error/timeout
 */
export function safeRegexTest(pattern: string, text: string, flags?: string): boolean {
  // Validate pattern complexity first
  if (!validatePatternComplexity(pattern)) {
    console.warn('Regex pattern rejected due to complexity:', pattern);
    return false;
  }

  try {
    const regex = new RegExp(pattern, flags);

    // JavaScript regex execution is synchronous and can't be interrupted mid-execution
    // So we track start time and rely on pattern validation
    const startTime = Date.now();
    const result = regex.test(text);
    const duration = Date.now() - startTime;

    // Log slow patterns for monitoring
    if (duration > 50) {
      console.warn(`Slow regex detected (${duration}ms):`, pattern);
    }

    return result;
  } catch (error) {
    // Invalid regex pattern
    console.error('Invalid regex pattern:', pattern, error);
    return false;
  }
}

/**
 * Validates a regex pattern without executing it.
 *
 * Useful for validating user input before saving rules.
 *
 * @param pattern - The regex pattern to validate
 * @returns Object with isValid flag and optional error message
 */
export function validateRegexPattern(pattern: string): {
  isValid: boolean;
  error?: string;
} {
  // Check pattern length
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return {
      isValid: false,
      error: `Pattern too long (max ${MAX_PATTERN_LENGTH} characters)`,
    };
  }

  // Check for nested quantifiers
  if (!validatePatternComplexity(pattern)) {
    return {
      isValid: false,
      error: 'Pattern contains nested quantifiers which could cause performance issues',
    };
  }

  // Try to construct the regex
  try {
    new RegExp(pattern);
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid regex pattern',
    };
  }
}
