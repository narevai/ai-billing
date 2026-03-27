import { createV3BillingMiddleware } from '@ai-billing/core';
import { Destination, AiBillingExtractorError } from '@ai-billing/core';
import type { OpenRouterUsageAccounting } from '@openrouter/ai-sdk-provider';

export interface OpenRouterProviderMetadata {
  openrouter?: {
    provider?: string;
    usage?: OpenRouterUsageAccounting;
    reasoning_details?: unknown[];
    annotations?: unknown[];
  };
}

export interface OpenRouterMiddlewareOptions<TCustomMeta> {
  destinations: Destination<TCustomMeta>[];
  metadata?: TCustomMeta;
  waitUntil?: (promise: Promise<unknown>) => void;
  onError?: (error: unknown) => void;
}

export function createOpenRouterV3Middleware<
  TCustomMeta = Record<string, unknown>,
>(options: OpenRouterMiddlewareOptions<TCustomMeta>) {
  return createV3BillingMiddleware<TCustomMeta>({
    destinations: options.destinations,
    metadata: options.metadata,
    waitUntil: options.waitUntil,
    onError: options.onError,

    extractor: ({ result, modelId, providerId, customMetadata }) => {
      const providerMetadata = result.providerMetadata as
        | OpenRouterProviderMetadata
        | undefined;
      const usage = providerMetadata?.openrouter?.usage;

      // Your original strict validation!
      if (!usage || typeof usage.cost !== 'number' || isNaN(usage.cost)) {
        throw new AiBillingExtractorError({
          message: `Expected 'usage.cost' to be a valid number.`,
          cause: providerMetadata,
        });
      }

      return {
        generationId: result.responseId ?? crypto.randomUUID(),
        modelId,
        providerId: providerId || 'openrouter',
        timestamp: Date.now(),
        metadata: customMetadata,
        usage: {
          subProviderId: providerMetadata?.openrouter?.provider,
          inputTokens: usage.promptTokens ?? 0,
          outputTokens: usage.completionTokens ?? 0,
          cacheReadTokens: usage.promptTokensDetails?.cachedTokens ?? 0,
          reasoningTokens: usage.completionTokensDetails?.reasoningTokens ?? 0,
          totalTokens: usage.totalTokens ?? 0,
          rawProviderCost: usage.cost,
          rawUpstreamInferenceCost: usage.costDetails?.upstreamInferenceCost,
        },
        cost: {
          amount: usage.cost,
          unit: 'base',
          currency: 'USD',
        },
      };
    },
  });
}
