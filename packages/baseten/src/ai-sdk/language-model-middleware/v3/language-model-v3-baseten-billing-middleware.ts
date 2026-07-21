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

interface BasetenRawUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    audio_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    accepted_prediction_tokens?: number;
    rejected_prediction_tokens?: number;
    audio_tokens?: number;
  };
}

/**
 * Configuration for {@link createBasetenV3Middleware}.
 */
export interface BasetenV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the Baseten provider (`@ai-sdk/baseten`).
 * Derives token usage from Baseten's raw OpenAI-compatible usage payload.
 */
export function createBasetenV3Middleware<TTags extends DefaultTags>(
  options: BasetenV3MiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage,
      providerMetadata: _empty,
      responseId,
      tags,
      webSearchCount,
    }) => {
      const rawUsage = usage?.raw as BasetenRawUsage | undefined;

      const basetenUsage: CostInputs = {
        promptTokens: rawUsage?.prompt_tokens ?? 0,
        completionTokens: rawUsage?.completion_tokens ?? 0,
        cacheReadTokens: rawUsage?.prompt_tokens_details?.cached_tokens ?? 0,
        cacheWriteTokens: 0,
        reasoningTokens:
          rawUsage?.completion_tokens_details?.reasoning_tokens ?? 0,
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
