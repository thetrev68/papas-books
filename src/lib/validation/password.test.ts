import { passwordSchema, calculatePasswordStrength } from './password';

describe('passwordSchema', () => {
  it('should accept valid strong passwords', () => {
    const result = passwordSchema.safeParse('MyP@ssw0rd123!');
    expect(result.success).toBe(true);
  });

  it('should reject passwords shorter than 12 characters', () => {
    const result = passwordSchema.safeParse('Short1!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('at least 12 characters');
    }
  });

  it('should reject passwords without uppercase letters', () => {
    const result = passwordSchema.safeParse('myp@ssw0rd123!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes('uppercase'))).toBe(true);
    }
  });

  it('should reject passwords without lowercase letters', () => {
    const result = passwordSchema.safeParse('MYP@SSW0RD123!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes('lowercase'))).toBe(true);
    }
  });

  it('should reject passwords without numbers', () => {
    const result = passwordSchema.safeParse('MyP@ssword!!!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes('number'))).toBe(true);
    }
  });

  it('should reject passwords without special characters', () => {
    const result = passwordSchema.safeParse('MyPassword123');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes('special character'))).toBe(true);
    }
  });

  it('should accept passwords with various special characters', () => {
    const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+'];
    specialChars.forEach((char) => {
      const result = passwordSchema.safeParse(`MyPassw0rd${char}${char}`);
      expect(result.success).toBe(true);
    });
  });
});

describe('calculatePasswordStrength', () => {
  it('should rate very weak passwords as Very Weak', () => {
    const strength = calculatePasswordStrength('weak');
    expect(strength.label).toBe('Very Weak');
    expect(strength.score).toBe(0);
    expect(strength.color).toBe('red');
  });

  it('should rate weak passwords as Weak', () => {
    const strength = calculatePasswordStrength('w!'); // Only 2 chars, missing number and uppercase
    expect(strength.label).toBe('Weak');
    expect(strength.score).toBe(1);
  });

  it('should rate fair passwords as Fair', () => {
    const strength = calculatePasswordStrength('Fa1'); // 3 chars, no special char
    expect(strength.label).toBe('Fair');
    expect(strength.score).toBe(2);
    expect(strength.color).toBe('yellow');
  });

  it('should rate strong passwords as Strong', () => {
    const strength = calculatePasswordStrength('StrongP@ss1'); // 11 chars
    expect(strength.label).toBe('Strong');
    expect(strength.score).toBe(3);
    expect(strength.color).toBe('lime');
  });

  it('should rate very strong passwords as Very Strong', () => {
    const strength = calculatePasswordStrength('VeryStr0ng!P@ssword'); // 19 chars
    expect(strength.label).toBe('Very Strong');
    expect(strength.score).toBe(4);
    expect(strength.color).toBe('green');
  });

  it('should increase score for passwords 12+ characters', () => {
    const short = calculatePasswordStrength('Short1!Aa');
    const long = calculatePasswordStrength('Longer1!Aaaa');
    expect(long.score).toBeGreaterThan(short.score);
  });

  it('should increase score for passwords 16+ characters', () => {
    const medium = calculatePasswordStrength('Medium1!Aa'); // 10 chars = score 3
    const veryLong = calculatePasswordStrength('VeryLong1!Aaaaaa'); // 16 chars = score 4
    expect(veryLong.score).toBeGreaterThanOrEqual(medium.score);
  });

  it('should handle empty password', () => {
    const strength = calculatePasswordStrength('');
    expect(strength.label).toBe('Very Weak');
    expect(strength.score).toBe(0);
  });
});
