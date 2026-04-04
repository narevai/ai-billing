import { z } from 'zod';

export const CostUnitSchema = z.enum(['base', 'cents', 'micros', 'nanos']);

export const CostSchema = z
  .object({
    amount: z.number(),
    currency: z.string(),
    unit: CostUnitSchema,
  })
  .strict();
