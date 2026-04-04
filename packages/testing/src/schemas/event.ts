import { CostSchema } from './cost.js';
import { z } from 'zod';

export const UsageSchema = z
  .object({
    subProviderId: z.string().optional(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
    reasoningTokens: z.number().optional(),
    cacheReadTokens: z.number().optional(),
    cacheWriteTokens: z.number().optional(),
    requestCount: z.number().optional(),
    rawProviderCost: z.number().optional(),
    rawUpstreamInferenceCost: z.number().optional(),
  })
  .strict();

export function createBillingEventSchema<TTagsSchema extends z.ZodTypeAny>(
  tagsSchema: TTagsSchema,
) {
  return z
    .object({
      generationId: z.string(),
      modelId: z.string(),
      provider: z.string(),
      usage: UsageSchema,
      cost: CostSchema.optional(),
      tags: tagsSchema,
    })
    .strict();
}

export const DefaultTagsSchema = z.record(z.string(), z.any());
export const BillingEventSchema = createBillingEventSchema(DefaultTagsSchema);
