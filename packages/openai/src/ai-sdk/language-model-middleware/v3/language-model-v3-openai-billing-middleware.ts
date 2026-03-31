import { calculateOpenAICost } from '../../../cost/index.js';
import type { OpenAICostInputs as OpenAIUsageInputs } from '../../../cost/calculate-openai-cost.js';
import { createV3BillingMiddleware } from '@ai-billing/core';
import type {
  BaseBillingMiddlewareOptions,
  PriceResolver,
  Cost,
  DefaultTags,
} from '@ai-billing/core';
import { JSONObject, SharedV3ProviderMetadata } from '@ai-sdk/provider';

interface OpenAIUsageAccounting extends JSONObject {
  acceptedPredictionTokens?: number;
  rejectedPredictionTokens?: number;
  logprobs?: number | boolean;
  serviceTier?: string;
}

type OpenAIProviderMetadata = SharedV3ProviderMetadata & {
  openai?: OpenAIUsageAccounting;
};

export interface OpenAIV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  prices: PriceResolver;
}

export function createOpenAIV3Middleware<TTags extends DefaultTags>(
  options: OpenAIV3MiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage,
      providerMetadata,
      responseId,
      tags,
    }) => {
      const _openaiMetadata = providerMetadata as
        | OpenAIProviderMetadata
        | undefined;

      const inputTokensTotal = usage?.inputTokens?.total ?? 0;
      const inputTokensCacheRead = usage?.inputTokens?.cacheRead ?? 0;
      const outputTokensTotal = usage?.outputTokens?.text ?? 0;
      const outputTokensReasoning = usage?.outputTokens?.reasoning ?? 0;

      const openAIUsage: OpenAIUsageInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: usage?.outputTokens?.text ?? 0,
        cacheReadTokens: usage?.inputTokens?.cacheRead ?? 0,
        cacheWriteTokens: usage?.inputTokens?.cacheWrite ?? 0,
        reasoningTokens: usage?.outputTokens?.reasoning ?? 0,
      };

      const pricing = await options.prices({
        modelId: model.modelId,
      });

      let calculatedCost: Cost | undefined = calculateOpenAICost({
        pricing,
        usage: openAIUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: model.provider || 'openai',
        timestamp: Date.now(),
        tags: tags,
        usage: {
          inputTokens: inputTokensTotal,
          outputTokens: outputTokensTotal,
          cacheReadTokens: inputTokensCacheRead,
          reasoningTokens: outputTokensReasoning,
          totalTokens: inputTokensTotal + outputTokensTotal,
        },
        ...(calculatedCost !== undefined && {
          cost: calculatedCost,
        }),
      };
    },
  });
}
