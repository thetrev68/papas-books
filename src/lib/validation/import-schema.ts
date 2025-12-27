import { z } from 'zod';
import type { CsvMapping } from '../../types/import';
import { MAX_DESCRIPTION_LENGTH } from './import';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const mappedTransactionSchema = z.object({
  date: z.string().regex(ISO_DATE_PATTERN, 'Date must be in YYYY-MM-DD format'),
  amount: z.number().int('Amount must be an integer number of cents'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(MAX_DESCRIPTION_LENGTH, `Description too long (max ${MAX_DESCRIPTION_LENGTH} chars)`),
});

export type MappedTransactionInput = z.infer<typeof mappedTransactionSchema>;

type RequiredColumn = {
  label: string;
  column: string | undefined;
};

const baseRowSchema = z.record(
  z.union([z.string(), z.array(z.string())]).transform((val) => {
    // Handle cases where PapaParse returns arrays for duplicate column names
    return Array.isArray(val) ? val[0] || '' : val;
  })
);

function getRequiredColumns(mapping: CsvMapping): RequiredColumn[] {
  const required: RequiredColumn[] = [
    { label: 'date', column: mapping.dateColumn },
    { label: 'description', column: mapping.descriptionColumn },
  ];

  if (mapping.amountMode === 'signed') {
    required.push({ label: 'amount', column: mapping.amountColumn });
  } else {
    required.push({ label: 'inflow', column: mapping.inflowColumn });
    required.push({ label: 'outflow', column: mapping.outflowColumn });
  }

  return required;
}

function buildRawRowSchema(mapping: CsvMapping) {
  const requiredColumns = getRequiredColumns(mapping);

  return baseRowSchema.superRefine((row, ctx) => {
    requiredColumns.forEach(({ label, column }) => {
      if (!column || column.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing mapping for ${label} column`,
        });
        return;
      }

      if (!(column in row)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing column "${column}" in CSV row`,
        });
      }
    });
  });
}

export function validateRawCsvRow(row: Record<string, string>, mapping: CsvMapping) {
  return buildRawRowSchema(mapping).safeParse(row);
}

export function validateMappedTransaction(input: MappedTransactionInput) {
  return mappedTransactionSchema.safeParse(input);
}
