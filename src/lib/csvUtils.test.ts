import { escapeCsvValue, formatCsvRow } from './csvUtils';

describe('csvUtils', () => {
  describe('escapeCsvValue', () => {
    it('should return empty string for null/undefined', () => {
      expect(escapeCsvValue(null)).toBe('');
      expect(escapeCsvValue(undefined)).toBe('');
    });

    it('should not escape simple strings', () => {
      expect(escapeCsvValue('Simple text')).toBe('Simple text');
      expect(escapeCsvValue('123')).toBe('123');
    });

    it('should escape strings with quotes', () => {
      expect(escapeCsvValue('He said "hello"')).toBe('"He said ""hello"""');
    });

    it('should escape strings with commas', () => {
      expect(escapeCsvValue('Last, First')).toBe('"Last, First"');
    });

    it('should escape strings with newlines', () => {
      expect(escapeCsvValue('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    });

    it('should escape strings with carriage returns', () => {
      expect(escapeCsvValue('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"');
    });
  });

  describe('formatCsvRow', () => {
    it('should format a simple row', () => {
      expect(formatCsvRow(['a', 'b', 'c'])).toBe('a,b,c');
    });

    it('should handle numbers', () => {
      expect(formatCsvRow(['text', 123, 'more'])).toBe('text,123,more');
    });

    it('should escape values that need it', () => {
      expect(formatCsvRow(['Smith, John', 'Normal', '"Quoted"'])).toBe(
        '"Smith, John",Normal,"""Quoted"""'
      );
    });

    it('should handle null and undefined values', () => {
      expect(formatCsvRow(['a', null, undefined, 'b'])).toBe('a,,,b');
    });

    it('should handle mixed types', () => {
      expect(formatCsvRow(['text', 42, null, 'comma,text'])).toBe('text,42,,"comma,text"');
    });
  });
});
