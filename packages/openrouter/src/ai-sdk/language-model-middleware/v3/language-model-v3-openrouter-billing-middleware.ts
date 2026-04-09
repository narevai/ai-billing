import {
  createV3BillingMiddleware,
  type BaseBillingMiddlewareOptions,
  AiBillingExtractorError,
  DefaultTags,
  type BillingEvent,
} from '@ai-billing/core';
import type { SharedV3ProviderMetadata } from '@ai-sdk/provider';
import type { OpenRouterUsageAccounting } from '@openrouter/ai-sdk-provider';

export type OpenRouterProviderMetadata = SharedV3ProviderMetadata & {
  openrouter?: {
    provider?: string;
    usage?: OpenRouterUsageAccounting;
    reasoning_details?: unknown[];
    annotations?: unknown[];
  };
};

type OpenRouterMiddlewareOptions<TTags extends DefaultTags> =
  BaseBillingMiddlewareOptions<TTags>;

export function createOpenRouterV3Middleware<TTags extends DefaultTags>(
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
        tags: tags,
        usage: {
          subProvider: openrouterMetadata?.openrouter?.provider,
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
      } satisfies BillingEvent<TTags>;
    },
  });
}
