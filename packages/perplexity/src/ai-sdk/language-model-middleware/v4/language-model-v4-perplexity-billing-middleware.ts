import { calculatePerplexityCost } from '../../../cost/index.js';
import { createV4BillingMiddleware, toUsage } from '@ai-billing/core';
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
import { JSONObject } from '@ai-sdk/provider';

export interface PerplexityV4UsageAccounting extends JSONObject {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number | null;
  /**
   * The amount of search context used to answer the request. Perplexity varies its flat
   * per-request search fee by this tier (see {@link calculatePerplexityCost} for how this
   * package simplifies that into a single flat `pricing.request` rate).
   */
  search_context_size?: 'low' | 'medium' | 'high' | null;
  citation_tokens?: number | null;
  num_search_queries?: number | null;
  reasoning_tokens?: number | null;
  cost?: {
    input_tokens_cost?: number | null;
    output_tokens_cost?: number | null;
    reasoning_tokens_cost?: number | null;
    request_cost?: number | null;
    citation_tokens_cost?: number | null;
    search_queries_cost?: number | null;
    total_cost?: number | null;
  } | null;
}

/**
 * Configuration for {@link createPerplexityV4Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields (falling back to
 * the raw provider usage payload); cost is computed from that usage and the resolved {@link ModelPricing}
 * using the same rules as the package's cost helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface PerplexityV4MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V4 billing middleware for the Perplexity provider (`@ai-sdk/perplexity`).
 * Perplexity has no prompt-caching feature, so cache-read/cache-write tokens are always reported as `0`.
 * All Perplexity `sonar` models are web-search-grounded and bill a flat per-request search fee
 * (`request_cost`) on top of token costs — see {@link calculatePerplexityCost} for how that is modeled.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link PerplexityV4MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V4 billing middleware instance for Perplexity.
 *
 * @example
 * ```ts
 * import { createPerplexity } from '@ai-sdk/perplexity';
 * import { wrapLanguageModel } from 'ai';
 * import { createPerplexityV4Middleware } from '@ai-billing/perplexity';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const perplexity = createPerplexity({ apiKey: process.env.PERPLEXITY_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'sonar-pro': {
 *     promptTokens: 3.0 / 1_000_000,
 *     completionTokens: 15.0 / 1_000_000,
 *     request: 6.0 / 1_000, // flat per-request search fee (low search_context_size rate)
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createPerplexityV4Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: perplexity('sonar-pro'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createPerplexityV4Middleware<TTags extends DefaultTags>(
  options: PerplexityV4MiddlewareOptions<TTags>,
) {
  return createV4BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage,
      providerMetadata: _empty,
      responseId,
      tags,
      webSearchCount,
    }) => {
      const perplexityRawUsage = usage?.raw as
        | PerplexityV4UsageAccounting
        | undefined;

      const inputTokensTotal =
        usage?.inputTokens?.total ?? perplexityRawUsage?.prompt_tokens ?? 0;
      const outputTokensTotal =
        usage?.outputTokens?.text ?? perplexityRawUsage?.completion_tokens ?? 0;
      const outputTokensReasoning =
        usage?.outputTokens?.reasoning ??
        perplexityRawUsage?.reasoning_tokens ??
        0;

      const perplexityUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        // Perplexity has no prompt-caching feature; always 0.
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: outputTokensReasoning,
        // Generic source-content-part count contributed by @ai-billing/core's base middleware
        // (one per `source` content part / citation); informational, see calculatePerplexityCost.
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'perplexity',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculatePerplexityCost({
        pricing,
        usage: perplexityUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'perplexity',
        tags,
        usage: toUsage(perplexityUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
