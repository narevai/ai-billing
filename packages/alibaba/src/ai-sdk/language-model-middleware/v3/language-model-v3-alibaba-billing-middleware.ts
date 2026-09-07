import { calculateAlibabaCost } from '../../../cost/index.js';
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

export interface AlibabaV3UsageAccounting extends JSONObject {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number | null;
  } | null;
  /**
   * Qwen models running in "thinking"/reasoning mode can populate
   * `completion_tokens_details.reasoning_tokens` in DashScope's OpenAI-compatible chat-completions
   * usage payload (the sample generate-text response this package was built from does not include
   * it since thinking mode was off, but it is a confirmed, non-speculative field for reasoning-capable
   * Qwen models such as `qwen-plus` with `enable_thinking`). Handled defensively and defaults to `0`
   * when absent so billing is unaffected for non-reasoning requests.
   */
  completion_tokens_details?: {
    reasoning_tokens?: number | null;
  } | null;
  service_tier?: string | null;
}

/**
 * Configuration for {@link createAlibabaV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface AlibabaV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the Alibaba provider (`@ai-sdk/alibaba`).
 * Deducts cache-read tokens from prompt tokens before billing — Alibaba charges only non-cached input at
 * the prompt rate, and cached tokens separately at the cache-read rate.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link AlibabaV3MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V3 billing middleware instance for Alibaba.
 *
 * @example
 * ```ts
 * import { createAlibaba } from '@ai-sdk/alibaba';
 * import { wrapLanguageModel } from 'ai';
 * import { createAlibabaV3Middleware } from '@ai-billing/alibaba';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const alibaba = createAlibaba({ apiKey: process.env.ALIBABA_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'qwen-plus': {
 *     promptTokens: 0.8 / 1_000_000,
 *     completionTokens: 2.0 / 1_000_000,
 *   },
 *   'qwen-turbo': {
 *     promptTokens: 0.3 / 1_000_000,
 *     completionTokens: 0.6 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createAlibabaV3Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: alibaba('qwen-plus'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createAlibabaV3Middleware<TTags extends DefaultTags>(
  options: AlibabaV3MiddlewareOptions<TTags>,
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
      const alibabaRawUsage = usage?.raw as
        | AlibabaV3UsageAccounting
        | undefined;

      const inputTokensTotal = alibabaRawUsage?.prompt_tokens ?? 0;
      const outputTokensTotal = alibabaRawUsage?.completion_tokens ?? 0;
      const inputTokensCacheRead =
        alibabaRawUsage?.prompt_tokens_details?.cached_tokens ?? 0;
      const inputTokensCacheWrite = 0;
      const outputTokensReasoning =
        alibabaRawUsage?.completion_tokens_details?.reasoning_tokens ?? 0;

      const alibabaUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'alibaba',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateAlibabaCost({
        pricing,
        usage: alibabaUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'alibaba',
        tags,
        usage: toUsage(alibabaUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
