import { sanitizeText, MAX_DESCRIPTION_LENGTH } from './import';

describe('sanitizeText', () => {
  it('should remove HTML tags', () => {
    expect(sanitizeText('<script>alert("xss")</script>Hello', 100)).toBe('Hello');
    expect(sanitizeText('<b>Bold</b>', 100)).toBe('Bold');
  });

  it('should enforce max length', () => {
    const longText = 'a'.repeat(MAX_DESCRIPTION_LENGTH + 10);
    expect(sanitizeText(longText, MAX_DESCRIPTION_LENGTH)).toHaveLength(MAX_DESCRIPTION_LENGTH);
  });

  it('should remove control characters', () => {
    // \x00 is null char
    expect(sanitizeText('Hello\x00World', 100)).toBe('HelloWorld');
  });

  it('should handle undefined or null input', () => {
    // @ts-expect-error - Testing runtime safety
    expect(sanitizeText(null, 100)).toBe('');
    // @ts-expect-error - Testing runtime safety
    expect(sanitizeText(undefined, 100)).toBe('');
  });

  it('should trim whitespace', () => {
    expect(sanitizeText('  Hello World  ', 100)).toBe('Hello World');
  });
});
