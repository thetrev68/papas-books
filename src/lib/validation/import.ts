import { z } from 'zod';

export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_PAYEE_LENGTH = 200;
export const MAX_MEMO_LENGTH = 1000;

// Sanitize HTML and dangerous characters
export function sanitizeText(text: string, maxLength: number): string {
  if (!text || typeof text !== 'string') return '';

  // Remove script/style blocks entirely before stripping tags
  let cleaned = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove remaining HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // Remove dangerous protocols (javascript:, data:, vbscript:, etc.)
  // This prevents XSS via protocol handlers
  cleaned = cleaned.replace(/javascript:/gi, '');
  cleaned = cleaned.replace(/data:/gi, '');
  cleaned = cleaned.replace(/vbscript:/gi, '');

  // Remove control characters (except newlines/tabs)
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
