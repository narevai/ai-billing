import {
  createV3BillingMiddleware,
  type BaseBillingMiddlewareOptions,
  type BillingEvent,
  DefaultTags,
} from '@ai-billing/core';
import { JSONObject, SharedV3ProviderMetadata } from '@ai-sdk/provider';

export interface ModelPricing {
  prompt: number;
  completion: number;
  inputCacheRead?: number;
  inputCacheWrite?: number;
  internalReasoning?: number;
  request?: number;
  discount?: number;
}

export type PriceResolver = (context: {
  modelId: string;
  provider: string;
}) => Promise<ModelPricing | null>;

interface OpenAIUsageAccounting extends JSONObject {
  acceptedPredictionTokens?: number;
  rejectedPredictionTokens?: number;
  logprobs?: number | boolean;
}

export type OpenAIProviderMetadata = SharedV3ProviderMetadata & {
  openai?: OpenAIUsageAccounting;
  'ai-billing'?: BillingEvent;
};

export interface OpenAIMiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  prices: PriceResolver;
}

export function createOpenAIV3Middleware<TTags extends DefaultTags>(
  options: OpenAIMiddlewareOptions<TTags>,
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
      const openaiMetadata = providerMetadata as
        | OpenAIProviderMetadata
        | undefined;
      const acceptedPredictionTokens =
        openaiMetadata?.openai?.acceptedPredictionTokens;
      const rejectedPredictionTokens =
        openaiMetadata?.openai?.rejectedPredictionTokens;
      const logprobs = openaiMetadata?.openai?.logprobs;

      const inputTokensTotal = usage?.inputTokens?.total ?? 0;
      const inputTokensNoCache = usage?.inputTokens?.noCache ?? 0;
      const inputTokensCacheRead = usage?.inputTokens?.cacheRead ?? 0;
      const inputTokensCacheWrite = usage?.inputTokens?.cacheWrite ?? 0;

      const outputTokensTotal = usage?.outputTokens?.total ?? 0;
      const outputTokensText = usage?.outputTokens?.text ?? 0;
      const outputTokensReasoning = usage?.outputTokens?.reasoning ?? 0;

      const pricing = await options.prices({
        modelId: model.modelId,
        provider: model.provider || 'openai',
      });

      let calculatedCost: number | undefined = undefined;

      if (pricing) {
        const promptCost = inputTokensNoCache * pricing.prompt;
        const cacheReadCost =
          inputTokensCacheRead * (pricing.inputCacheRead ?? 0);
        const cacheWriteCost = 0 * (pricing.inputCacheWrite ?? 0);

        const textCompletionCost = outputTokensText * pricing.completion;
        const reasoningCost =
          outputTokensReasoning *
          (pricing.internalReasoning ?? pricing.completion);

        const requestFee = pricing.request ?? 0;

        const grossCost =
          promptCost +
          cacheReadCost +
          cacheWriteCost +
          textCompletionCost +
          reasoningCost +
          requestFee;

        calculatedCost = grossCost * (1 - (pricing.discount ?? 0));
      }

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
          cost: {
            amount: calculatedCost,
            unit: 'base',
            currency: 'USD',
          },
        }),
      };
    },
  });
}
