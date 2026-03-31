import {
  createV3BillingMiddleware,
  type BaseBillingMiddlewareOptions,
  AiBillingExtractorError,
  type BillingEvent,
} from '@ai-billing/core';
import type { JSONObject } from '@ai-sdk/provider';
import type { OpenRouterUsageAccounting } from '@openrouter/ai-sdk-provider';

export interface OpenRouterProviderMetadata {
  openrouter?: {
    provider?: string;
    usage?: OpenRouterUsageAccounting;
    reasoning_details?: unknown[];
    annotations?: unknown[];
  };
  'ai-billing'?: BillingEvent;
}

type OpenRouterMiddlewareOptions<TTags extends JSONObject> =
  BaseBillingMiddlewareOptions<TTags>;

export function createOpenRouterV3Middleware<TTags extends JSONObject>(
  options: OpenRouterMiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
    ...options,

    buildEvent: ({
      model,
      usage: _sdkUsage, // We ignore sdk usage because OpenRouter provides better cost metrics
      providerMetadata,
      responseId,
      tags,
    }) => {
      const openrouterMetadata = providerMetadata as
        | OpenRouterProviderMetadata
        | undefined;
      const openRouterUsage = openrouterMetadata?.openrouter?.usage;

      if (
        !openRouterUsage ||
        typeof openRouterUsage.cost !== 'number' ||
        isNaN(openRouterUsage.cost)
      ) {
        throw new AiBillingExtractorError({
          message: `Expected 'usage.cost' to be a valid number.`,
          cause: openrouterMetadata,
        });
      }

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: model.provider || 'openrouter',
        timestamp: Date.now(),
        tags: tags,
        usage: {
          subProviderId: openrouterMetadata?.openrouter?.provider,
          inputTokens: openRouterUsage.promptTokens ?? 0,
          outputTokens: openRouterUsage.completionTokens ?? 0,
          cacheReadTokens:
            openRouterUsage.promptTokensDetails?.cachedTokens ?? 0,
          reasoningTokens:
            openRouterUsage.completionTokensDetails?.reasoningTokens ?? 0,
          totalTokens: openRouterUsage.totalTokens ?? 0,
          rawProviderCost: openRouterUsage.cost,
          rawUpstreamInferenceCost:
            openRouterUsage.costDetails?.upstreamInferenceCost,
        },
        cost: {
          amount: openRouterUsage.cost,
          unit: 'base',
          currency: 'USD',
        },
      };
    },
  });
}
