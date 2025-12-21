import { z } from 'zod';

export const csvMappingSchema = z
  .object({
    dateColumn: z.string().min(1, 'Date column is required'),
    amountColumn: z.string().optional(), // Only required if amountMode='signed'
    descriptionColumn: z.string().min(1, 'Description column is required'),
    dateFormat: z.enum(['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'MM-dd-yyyy']),
    hasHeaderRow: z.boolean(),
    amountMode: z.enum(['signed', 'separate']),
    inflowColumn: z.string().optional(),
    outflowColumn: z.string().optional(),
  })
  .refine(
    (data) => {
      // If signed mode, amountColumn is required
      if (data.amountMode === 'signed') {
        return !!data.amountColumn;
      }
      return true;
    },
    {
      message: 'Amount column is required for signed mode',
      path: ['amountColumn'],
    }
  )
  .refine(
    (data) => {
      // If separate mode, both inflow and outflow are required
      if (data.amountMode === 'separate') {
        return !!data.inflowColumn && !!data.outflowColumn;
      }
      return true;
    },
    {
      message: 'Both inflow and outflow columns are required for separate mode',
      path: ['inflowColumn'],
    }
  );

export type ValidatedCsvMapping = z.infer<typeof csvMappingSchema>;
