import { calculateGroqCost } from '../../../cost/index.js';
import type { GroqCostInputs } from '../../../cost/calculate-groq-cost.js';
import { createV3BillingMiddleware } from '@ai-billing/core';
import type {
  BaseBillingMiddlewareOptions,
  PriceResolver,
  Cost,
  DefaultTags,
  PriceResolverContext,
  ModelPricing,
  BillingEvent,
} from '@ai-billing/core';

interface GroqRawUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;

  prompt_tokens_details?: {
    cached_tokens?: number;
  };

  completion_tokens_details?: {
    reasoning_tokens?: number;
  };

  // Groq-specific timing metrics
  queue_time?: number;
  prompt_time?: number;
  completion_time?: number;
  total_time?: number;
}

export interface GroqV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

export function createGroqV3Middleware<TTags extends DefaultTags>(
  options: GroqV3MiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage,
      providerMetadata: _empty,
      responseId,
      tags,
    }) => {
      const rawUsage = usage?.raw as GroqRawUsage | undefined;

      const totalInput = rawUsage?.prompt_tokens ?? 0;
      const inputTokensCacheRead =
        rawUsage?.prompt_tokens_details?.cached_tokens ?? 0;

      const totalOutput = rawUsage?.completion_tokens ?? 0;
      const outputTokensReasoning =
        rawUsage?.completion_tokens_details?.reasoning_tokens ?? 0;

      const inputTokensTotal = Math.max(0, totalInput - inputTokensCacheRead);
      const outputTokensTotal = Math.max(
        0,
        totalOutput - outputTokensReasoning,
      );

      const groqUsage: GroqCostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: 0,
        reasoningTokens: outputTokensReasoning,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'groq',
      } as PriceResolverContext);

      let calculatedCost: Cost | undefined = calculateGroqCost({
        pricing,
        usage: groqUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'groq',
        tags: tags,
        usage: {
          inputTokens: inputTokensTotal,
          outputTokens: outputTokensTotal,
          cacheReadTokens: inputTokensCacheRead,
          cacheWriteTokens: 0,
          reasoningTokens: outputTokensReasoning,
          totalTokens: inputTokensTotal + outputTokensTotal,
        },
        ...(calculatedCost !== undefined && {
          cost: calculatedCost,
        }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
