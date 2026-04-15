import {
  createV3BillingMiddleware,
  type BaseBillingMiddlewareOptions,
  AiBillingExtractorError,
  DefaultTags,
  type BillingEvent,
} from '@ai-billing/core';
import type { SharedV3ProviderMetadata } from '@ai-sdk/provider';
import type { OpenRouterUsageAccounting } from '@openrouter/ai-sdk-provider';

/**
 * OpenRouter-specific fields attached to AI SDK {@link SharedV3ProviderMetadata}.
 *
 * The billing middleware reads token and cost fields from `openrouter.usage` (including numeric `cost`) and
 * ignores normalized SDK usage counts in favor of these values.
 */
export type OpenRouterProviderMetadata = SharedV3ProviderMetadata & {
  openrouter?: {
    provider?: string;
    usage?: OpenRouterUsageAccounting;
    reasoning_details?: unknown[];
    annotations?: unknown[];
  };
};

/**
 * Configuration for {@link createOpenRouterV3Middleware}.
 *
 * Matches {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`). There
 * is no `priceResolver`: billed amount and token breakdown come from OpenRouter metadata (`usage.cost`, etc.).
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export type OpenRouterV3MiddlewareOptions<TTags extends DefaultTags> =
  BaseBillingMiddlewareOptions<TTags>;

/**
 * Creates a V3 billing middleware for OpenRouter (`@openrouter/ai-sdk-provider`).
 * Extracts cost and usage from `openrouter` provider metadata; requires numeric `usage.cost`.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Shared billing options; see {@link BaseBillingMiddlewareOptions}.
 * @returns A V3 billing middleware instance for OpenRouter.
 *
 * @example
 * Same wiring as `examples/dev-sandbox/app/api/openrouter` (`createOpenRouterMiddleware` is this function's
 * export alias from `@ai-billing/openrouter`).
 *
 * ```ts
 * import { createOpenRouter } from '@openrouter/ai-sdk-provider';
 * import { wrapLanguageModel } from 'ai';
 * import { createOpenRouterV3Middleware } from '@ai-billing/openrouter';
 * import { consoleDestination } from '@ai-billing/core';
 *
 * const openrouter = createOpenRouter({
 *   apiKey: process.env.OPENROUTER_API_KEY,
 * });
 *
 * const billingMiddleware = createOpenRouterV3Middleware({
 *   destinations: [consoleDestination()],
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: openrouter('google/gemini-2.0-flash-001'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createOpenRouterV3Middleware<TTags extends DefaultTags>(
  options: OpenRouterV3MiddlewareOptions<TTags>,
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
