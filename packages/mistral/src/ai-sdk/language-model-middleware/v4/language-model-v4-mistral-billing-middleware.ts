import { calculateMistralCost } from '../../../cost/index.js';
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

export interface MistralV4UsageAccounting extends JSONObject {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number | null;
  } | null;
  /**
   * Speculative: Mistral's chat completions usage payload does not currently expose a
   * `completion_tokens_details.reasoning_tokens` field in any confirmed response (including the
   * sample generate-text response this package was built from). This is included defensively for
   * possible future reasoning models (e.g. Magistral) that may report reasoning tokens the same way
   * OpenAI-compatible APIs do. It defaults to `0` when absent, so billing is unaffected until/unless
   * Mistral actually starts returning it.
   */
  completion_tokens_details?: {
    reasoning_tokens?: number | null;
  } | null;
  service_tier?: string | null;
}

/**
 * Configuration for {@link createMistralV4Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface MistralV4MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V4 billing middleware for the Mistral provider (`@ai-sdk/mistral`).
 * Deducts cache-read tokens from prompt tokens before billing — Mistral charges only non-cached input at
 * the prompt rate, and cached tokens separately at the cache-read rate.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link MistralV4MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V4 billing middleware instance for Mistral.
 *
 * @example
 * ```ts
 * import { createMistral } from '@ai-sdk/mistral';
 * import { wrapLanguageModel } from 'ai';
 * import { createMistralV4Middleware } from '@ai-billing/mistral';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const mistral = createMistral({ apiKey: process.env.MISTRAL_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'mistral-large-latest': {
 *     promptTokens: 2.0 / 1_000_000,
 *     completionTokens: 6.0 / 1_000_000,
 *   },
 *   'mistral-small-latest': {
 *     promptTokens: 0.1 / 1_000_000,
 *     completionTokens: 0.3 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createMistralV4Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: mistral('mistral-large-latest'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createMistralV4Middleware<TTags extends DefaultTags>(
  options: MistralV4MiddlewareOptions<TTags>,
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
      const mistralRawUsage = usage?.raw as
        | MistralV4UsageAccounting
        | undefined;

      const inputTokensTotal = mistralRawUsage?.prompt_tokens ?? 0;
      const outputTokensTotal = mistralRawUsage?.completion_tokens ?? 0;
      const inputTokensCacheRead =
        mistralRawUsage?.prompt_tokens_details?.cached_tokens ?? 0;
      const inputTokensCacheWrite = 0;
      const outputTokensReasoning =
        mistralRawUsage?.completion_tokens_details?.reasoning_tokens ?? 0;

      const mistralUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'mistral',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateMistralCost({
        pricing,
        usage: mistralUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'mistral',
        tags,
        usage: toUsage(mistralUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
