import { AiBillingExtractorError } from '@ai-billing/core';
import { createV4BillingMiddleware } from '@ai-billing/core/v4';
import type {
  BaseBillingMiddlewareOptions,
  DefaultTags,
  BillingEvent,
} from '@ai-billing/types';
import type { SharedV4ProviderMetadata } from '@ai-sdk/provider';
import type { OpenRouterUsageAccounting } from '@openrouter/ai-sdk-provider';

/**
 * OpenRouter-specific fields attached to AI SDK {@link SharedV4ProviderMetadata}.
 *
 * The billing middleware reads token and cost fields from `openrouter.usage` (including numeric `cost`) and
 * ignores normalized SDK usage counts in favor of these values.
 */
export type OpenRouterProviderMetadata = SharedV4ProviderMetadata & {
  openrouter?: {
    provider?: string;
    usage?: OpenRouterUsageAccounting;
    reasoning_details?: unknown[];
    annotations?: unknown[];
  };
};

/**
 * Configuration for {@link createOpenRouterV4Middleware}.
 *
 * Matches {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`). There
 * is no `priceResolver`: billed amount and token breakdown come from OpenRouter metadata (`usage.cost`, etc.).
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export type OpenRouterV4MiddlewareOptions<TTags extends DefaultTags> =
  BaseBillingMiddlewareOptions<TTags>;

/**
 * Creates a V4 billing middleware for OpenRouter (`@openrouter/ai-sdk-provider`).
 * Extracts cost and usage from `openrouter` provider metadata; requires numeric `usage.cost`.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Shared billing options; see {@link BaseBillingMiddlewareOptions}.
 * @returns A V4 billing middleware instance for OpenRouter.
 *
 * @example
 * Targets AI SDK v7 (`LanguageModelV4Middleware`) via the package's `./v4` export subpath.
 *
 * ```ts
 * import { createOpenRouter } from '@openrouter/ai-sdk-provider';
 * import { wrapLanguageModel } from 'ai';
 * import { createOpenRouterV4Middleware } from '@ai-billing/openrouter/v4';
 * import { consoleDestination } from '@ai-billing/core';
 *
 * const openrouter = createOpenRouter({
 *   apiKey: process.env.OPENROUTER_API_KEY,
 * });
 *
 * const billingMiddleware = createOpenRouterV4Middleware({
 *   destinations: [consoleDestination()],
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: openrouter('google/gemini-2.0-flash-001'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createOpenRouterV4Middleware<TTags extends DefaultTags>(
  options: OpenRouterV4MiddlewareOptions<TTags>,
) {
  return createV4BillingMiddleware<TTags>({
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
