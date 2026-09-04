import { calculateCerebrasCost } from '../../../cost/index.js';
import { createV3BillingMiddleware, toUsage } from '@ai-billing/core';
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

export interface CerebrasV3UsageAccounting extends JSONObject {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number | null;
  } | null;
  completion_tokens_details?: {
    reasoning_tokens?: number | null;
    /**
     * OpenAI-style speculative-decoding counters. Cerebras returns these (currently always 0 in
     * captured payloads) but there is no corresponding ModelPricing field for predicted-output
     * pricing, so they are intentionally not billed. Kept here only for completeness/typing.
     */
    accepted_prediction_tokens?: number | null;
    rejected_prediction_tokens?: number | null;
  } | null;
}

/**
 * Configuration for {@link createCerebrasV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface CerebrasV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the Cerebras provider (`@ai-sdk/cerebras`).
 * Deducts cache-read tokens from prompt tokens and reasoning tokens from completion tokens before
 * billing the base rates — Cerebras charges only non-cached input at the prompt rate, cached input
 * separately at the cache-read rate, and reasoning tokens (a subset of `completion_tokens`) at the
 * completion rate.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link CerebrasV3MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V3 billing middleware instance for Cerebras.
 *
 * @example
 * ```ts
 * import { createCerebras } from '@ai-sdk/cerebras';
 * import { wrapLanguageModel } from 'ai';
 * import { createCerebrasV3Middleware } from '@ai-billing/cerebras';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const cerebras = createCerebras({ apiKey: process.env.CEREBRAS_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   // NOTE: unverified estimate — confirm against https://www.cerebras.ai/pricing before shipping.
 *   'gpt-oss-120b': {
 *     promptTokens: 0.25 / 1_000_000,
 *     completionTokens: 0.69 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createCerebrasV3Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: cerebras('gpt-oss-120b'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createCerebrasV3Middleware<TTags extends DefaultTags>(
  options: CerebrasV3MiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage,
      providerMetadata: _empty,
      responseId,
      tags,
      webSearchCount,
    }) => {
      const cerebrasRawUsage = usage?.raw as
        | CerebrasV3UsageAccounting
        | undefined;

      const inputTokensTotal = cerebrasRawUsage?.prompt_tokens ?? 0;
      const outputTokensTotal = cerebrasRawUsage?.completion_tokens ?? 0;
      const inputTokensCacheRead =
        cerebrasRawUsage?.prompt_tokens_details?.cached_tokens ?? 0;
      const inputTokensCacheWrite = 0;
      const outputTokensReasoning =
        cerebrasRawUsage?.completion_tokens_details?.reasoning_tokens ?? 0;

      const cerebrasUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'cerebras',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateCerebrasCost({
        pricing,
        usage: cerebrasUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'cerebras',
        tags,
        usage: toUsage(cerebrasUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
