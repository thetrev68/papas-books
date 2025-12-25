import { z } from 'zod';

export const insertCategorySchema = z.object({
  booksetId: z.string().uuid(),
  name: z.string().min(1, 'Category name is required').max(100),
  isTaxDeductible: z.boolean(),
  taxLineItem: z.string().max(200).optional(),
  parentCategoryId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;

export const updateCategorySchema = insertCategorySchema
  .partial()
  .omit({ booksetId: true })
  .extend({
    updatedAt: z.string().optional(), // For optimistic locking
  });

export type UpdateCategory = z.infer<typeof updateCategorySchema>;
