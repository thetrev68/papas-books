import { z } from 'zod';
import { MAX_DESCRIPTION_LENGTH } from '../constants';

export const MAX_PAYEE_LENGTH = 200;
export const MAX_MEMO_LENGTH = 1000;

// Sanitize HTML and dangerous characters
// Note: CSV import data should be plain text, not HTML. This function converts
// any HTML-like content to plain text by removing all tags and dangerous content.
export function sanitizeText(text: string, maxLength: number): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // Strategy: Since CSV data should be plain text, we strip ALL HTML-like content
  // rather than trying to parse/sanitize HTML (which is error-prone with regex).

  // CRITICAL SECURITY FIX: Remove script/style tags AND their content entirely
  // We do this iteratively to handle malformed/nested tags that could bypass single-pass regex
  // This prevents bypasses like: <script >alert(1)</script >, <scr<script>ipt>, etc.

  // Remove script blocks (tag + content) with multiple passes to handle all variations
  // We use robust patterns that:
  // - Match normal pairs like <script ...>...</script ...>
  // - Match malformed/whitespace-heavy closing tags like </script\t\n bar>
  // - Remove unterminated/malformed opening tags (remove to next '>' or to EOL)
  let previousLength;
  do {
    previousLength = cleaned.length;
    // Match complete <script> ... </script> blocks, allowing attributes on the closing tag
    cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, '');
    // Remove any remaining opening <script until the next '>' (or to end-of-string) to handle malformed tags
    cleaned = cleaned.replace(/<script\b[\s\S]*?(>|$)/gi, '');
  } while (cleaned.length !== previousLength);

  // Remove style blocks (tag + content) with multiple passes
  do {
    previousLength = cleaned.length;
    cleaned = cleaned.replace(/<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gi, '');
    cleaned = cleaned.replace(/<style\b[\s\S]*?(>|$)/gi, '');
  } while (cleaned.length !== previousLength);

  // Remove all other HTML tags (but keep their text content)
  // Loop to handle nested/malformed tags
  do {
    previousLength = cleaned.length;
    // Remove standard tags
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    // Remove incomplete tags at the end (e.g., "text<div" with no closing >)
    cleaned = cleaned.replace(/<[^<]*$/g, '');
  } while (cleaned.length !== previousLength);

  // Final pass: Remove any remaining angle brackets (artifacts from malformed tags)
  cleaned = cleaned.replace(/[<>]/g, '');

  // Remove dangerous protocol handlers that could remain in plain text
  // (e.g., "javascript:alert(1)" should become "alert(1)")
  cleaned = cleaned.replace(/\b(javascript|data|vbscript):/gi, '');

  // Remove control characters (except newlines/tabs/carriage returns)
  // \x00-\x08: Null, Start of Heading, Start of Text, End of Text, End of Transmission, Enquiry, Acknowledge, Bell, Backspace
  // \x0B-\x0C: Vertical Tab, Form Feed
  // \x0E-\x1F: Shift Out, Shift In, DLE, DC1, DC2, DC3, DC4, NAK, SYN, ETB, CAN, EM, SUB, ESC, FS, GS, RS, US
  // \x7F: Delete
  // eslint-disable-next-line no-control-regex
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Trim whitespace
  cleaned = cleaned.trim();

  // Enforce max length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }

  return cleaned;
}

// Validate CSV row data
export const csvRowSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  amount: z.string().min(1, 'Amount is required'),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH, `Description too long (max ${MAX_DESCRIPTION_LENGTH} chars)`),
});

export function validateCsvRow(
  row: Record<string, string>
): z.SafeParseReturnType<unknown, z.infer<typeof csvRowSchema>> {
  return csvRowSchema.safeParse(row);
}
