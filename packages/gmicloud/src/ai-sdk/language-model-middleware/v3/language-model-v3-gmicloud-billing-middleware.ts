import { calculateGmicloudCost } from '../../../cost/index.js';
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

export interface GmicloudV3UsageAccounting extends JSONObject {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number | null;
  } | null;
  /**
   * Reasoning tokens for GMI Cloud's reasoning-capable models (e.g.
   * `deepseek-ai/DeepSeek-V4-Flash-0731`), confirmed present in captured `generateText` usage —
   * 11 of 14 completion tokens were reasoning tokens in the sample this package was built from.
   * Defaults to `0` when absent (non-reasoning models).
   */
  completion_tokens_details?: {
    reasoning_tokens?: number | null;
  } | null;
}

/**
 * Configuration for {@link createGmicloudV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface GmicloudV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the GMI Cloud provider (`@ai-sdk/gmicloud`).
 * Deducts cache-read tokens from prompt tokens before billing — GMI Cloud charges only non-cached input at
 * the prompt rate, and cached tokens separately at the cache-read rate.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link GmicloudV3MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V3 billing middleware instance for GMI Cloud.
 *
 * @example
 * ```ts
 * import { createGmicloud } from '@ai-sdk/gmicloud';
 * import { wrapLanguageModel } from 'ai';
 * import { createGmicloudV3Middleware } from '@ai-billing/gmicloud';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const gmicloud = createGmicloud({ apiKey: process.env.GMI_CLOUD_APIKEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'deepseek-ai/DeepSeek-V4-Flash-0731': {
 *     promptTokens: 0.1 / 1_000_000,
 *     completionTokens: 0.3 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createGmicloudV3Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: gmicloud('deepseek-ai/DeepSeek-V4-Flash-0731'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createGmicloudV3Middleware<TTags extends DefaultTags>(
  options: GmicloudV3MiddlewareOptions<TTags>,
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
      const gmicloudRawUsage = usage?.raw as
        | GmicloudV3UsageAccounting
        | undefined;

      const inputTokensTotal = gmicloudRawUsage?.prompt_tokens ?? 0;
      const outputTokensTotal = gmicloudRawUsage?.completion_tokens ?? 0;
      const inputTokensCacheRead =
        gmicloudRawUsage?.prompt_tokens_details?.cached_tokens ?? 0;
      const inputTokensCacheWrite = 0;
      const outputTokensReasoning =
        gmicloudRawUsage?.completion_tokens_details?.reasoning_tokens ?? 0;

      const gmicloudUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'gmicloud',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateGmicloudCost({
        pricing,
        usage: gmicloudUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'gmicloud',
        tags,
        usage: toUsage(gmicloudUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
