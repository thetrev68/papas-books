import { sanitizeText } from './import';
import { MAX_DESCRIPTION_LENGTH } from '../constants';

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

  it('should remove dangerous protocol handlers', () => {
    expect(sanitizeText('javascript:alert("XSS")', 100)).toBe('alert("XSS")');
    // Note: <script> tags are also removed, so only "text/html," remains
    expect(sanitizeText('data:text/html,<script>alert(1)</script>', 100)).toBe('text/html,');
    expect(sanitizeText('vbscript:msgbox("XSS")', 100)).toBe('msgbox("XSS")');
  });

  it('should handle mixed XSS attacks', () => {
    expect(sanitizeText('<img src=x onerror=alert(1)>', 100)).toBe('');
    expect(sanitizeText('<svg/onload=alert(1)>', 100)).toBe('');
    expect(sanitizeText('<body onload=alert(1)>', 100)).toBe('');
  });

  it('should remove script and style blocks completely', () => {
    expect(sanitizeText('<script>malicious code</script>Safe text', 100)).toBe('Safe text');
    // Malformed closing tag with whitespace and extra garbage should also be removed
    expect(sanitizeText('<script>malicious code</script\t\n bar>Safe text', 100)).toBe('Safe text');
    expect(sanitizeText('<style>body { display: none; }</style>Visible', 100)).toBe('Visible');
  });
});
