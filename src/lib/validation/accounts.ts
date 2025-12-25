import { z } from 'zod';

export const insertAccountSchema = z.object({
  booksetId: z.string().uuid(),
  name: z.string().min(1, 'Account name is required').max(100),
  type: z.enum(['Asset', 'Liability']),
  openingBalance: z.number().int(),
  openingBalanceDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
});

export type InsertAccount = z.infer<typeof insertAccountSchema>;

export const updateAccountSchema = insertAccountSchema.partial().omit({ booksetId: true }).extend({
  updatedAt: z.string().optional(), // For optimistic locking
});

export type UpdateAccount = z.infer<typeof updateAccountSchema>;
