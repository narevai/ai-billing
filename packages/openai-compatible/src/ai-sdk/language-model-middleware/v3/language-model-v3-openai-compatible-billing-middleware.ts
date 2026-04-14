import {
  calculateOpenAICompatibleCost,
  type OpenAICompatibleCostInputs,
} from '../../../cost/index.js';
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

export interface OpenAICompatibleV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
  providerId: string;
}

/**
 * Creates a V3 billing middleware for OpenAI-compatible providers.
 *
 * @param options - Middleware configuration, provider id, and pricing resolver.
 * @returns A billing middleware that emits normalized billing events.
 */
export function createOpenAICompatibleV3Middleware<TTags extends DefaultTags>(
  options: OpenAICompatibleV3MiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({ model, usage, responseId, tags }) => {
      const inputTokensTotal = usage?.inputTokens?.total ?? 0;
      const inputTokensCacheRead = usage?.inputTokens?.cacheRead ?? 0;
      const outputTokensTotal = usage?.outputTokens?.total ?? 0;
      const outputTokensReasoning = usage?.outputTokens?.reasoning ?? 0;

      const openAICompatibleUsage: OpenAICompatibleCostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: usage?.inputTokens?.cacheWrite ?? 0,
        reasoningTokens: outputTokensReasoning,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: options.providerId,
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateOpenAICompatibleCost({
        pricing,
        usage: openAICompatibleUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: options.providerId,
        tags,
        usage: {
          inputTokens: inputTokensTotal,
          outputTokens: outputTokensTotal,
          cacheReadTokens: inputTokensCacheRead,
          reasoningTokens: outputTokensReasoning,
          totalTokens: inputTokensTotal + outputTokensTotal,
        },
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
