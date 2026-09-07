import { calculateFireworksCost } from '../../../cost/index.js';
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

export interface FireworksV4UsageAccounting extends JSONObject {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number | null;
  } | null;
  completion_tokens_details?: {
    reasoning_tokens?: number | null;
  } | null;
  /**
   * Fireworks duplicates the reasoning-token count under this key as well as under
   * `completion_tokens_details.reasoning_tokens` — both fields carry the *same* value. Read exactly
   * one of them (see the extraction logic in {@link createFireworksV4Middleware}), never sum both, or
   * reasoning tokens get double counted.
   */
  output_tokens_details?: {
    reasoning_tokens?: number | null;
  } | null;
}

/**
 * Configuration for {@link createFireworksV4Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface FireworksV4MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V4 billing middleware for the Fireworks provider (`@ai-sdk/fireworks`).
 * Deducts cache-read tokens from prompt tokens before billing — Fireworks charges only non-cached input at
 * the prompt rate, and cached tokens separately at the cache-read rate. Reasoning tokens are deducted from
 * completion tokens and billed at the completion rate, since Fireworks has no separate reasoning-token
 * pricing tier.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link FireworksV4MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V4 billing middleware instance for Fireworks.
 *
 * @example
 * ```ts
 * import { createFireworks } from '@ai-sdk/fireworks';
 * import { wrapLanguageModel } from 'ai';
 * import { createFireworksV4Middleware } from '@ai-billing/fireworks';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const fireworks = createFireworks({ apiKey: process.env.FIREWORKS_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'accounts/fireworks/models/glm-5p3-flash': {
 *     promptTokens: 0.2 / 1_000_000,
 *     completionTokens: 0.8 / 1_000_000,
 *     inputCacheReadTokens: 0.1 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createFireworksV4Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: fireworks('accounts/fireworks/models/glm-5p3-flash'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createFireworksV4Middleware<TTags extends DefaultTags>(
  options: FireworksV4MiddlewareOptions<TTags>,
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
      const fireworksRawUsage = usage?.raw as
        | FireworksV4UsageAccounting
        | undefined;

      const inputTokensTotal = fireworksRawUsage?.prompt_tokens ?? 0;
      const outputTokensTotal = fireworksRawUsage?.completion_tokens ?? 0;
      const inputTokensCacheRead =
        fireworksRawUsage?.prompt_tokens_details?.cached_tokens ?? 0;
      const inputTokensCacheWrite = 0;
      // Fireworks reports the same reasoning-token count under both
      // `completion_tokens_details.reasoning_tokens` and `output_tokens_details.reasoning_tokens`.
      // Read exactly one of them (preferring the former, falling back to the latter) — never sum both,
      // or reasoning tokens get double counted.
      const outputTokensReasoning =
        fireworksRawUsage?.completion_tokens_details?.reasoning_tokens ??
        fireworksRawUsage?.output_tokens_details?.reasoning_tokens ??
        0;

      const fireworksUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'fireworks',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateFireworksCost({
        pricing,
        usage: fireworksUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'fireworks',
        tags,
        usage: toUsage(fireworksUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
