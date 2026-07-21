import { calculateBasetenCost } from '../../../cost/index.js';
import { createV3BillingMiddleware, toUsage } from '@ai-billing/core';
import type {
  CostInputs,
  BaseBillingMiddlewareOptions,
  PriceResolver,
  Cost,
  DefaultTags,
  PriceResolverContext,
  ModelPricing,
  BillingEvent,
} from '@ai-billing/types';

export interface BasetenV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the Baseten provider (`@ai-sdk/baseten`).
 */
export function createBasetenV3Middleware<TTags extends DefaultTags>(
  options: BasetenV3MiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({ model, usage, responseId, tags, webSearchCount }) => {
      const basetenUsage: CostInputs = {
        promptTokens: usage?.inputTokens?.total ?? 0,
        completionTokens: usage?.outputTokens?.total ?? 0,
        cacheReadTokens: usage?.inputTokens?.cacheRead ?? 0,
        cacheWriteTokens: usage?.inputTokens?.cacheWrite ?? 0,
        reasoningTokens: usage?.outputTokens?.reasoning ?? 0,
        webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'baseten',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateBasetenCost({
        pricing,
        usage: basetenUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'baseten',
        tags,
        usage: toUsage(basetenUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
