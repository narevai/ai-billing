import { calculateTogetheraiCost } from '../../../cost/index.js';
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

export interface TogetheraiV4UsageAccounting extends JSONObject {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  /**
   * Confirmed present on Together AI's OpenAI-compatible chat-completions usage block (top-level,
   * not nested under `completion_tokens_details` the way Mistral/Groq report it). Observed as `0` on
   * the non-reasoning `openai/gpt-oss-20b` sample this package was built from; included so reasoning
   * models on Together AI (e.g. DeepSeek-R1, other gpt-oss variants) are billed correctly once they
   * report a non-zero value.
   */
  reasoning_tokens?: number | null;
}

/**
 * Configuration for {@link createTogetheraiV4Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface TogetheraiV4MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V4 billing middleware for the Together AI provider (`@ai-sdk/togetherai`).
 * Together AI's usage payload does not report any cache fields, so cache-read/cache-write tokens are
 * always billed as zero; `reasoning_tokens` is read as a flat top-level field (not nested, unlike some
 * other OpenAI-compatible providers in this repo) and deducted from completion tokens before billing.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link TogetheraiV4MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V4 billing middleware instance for Together AI.
 *
 * @example
 * ```ts
 * import { createTogetherAI } from '@ai-sdk/togetherai';
 * import { wrapLanguageModel } from 'ai';
 * import { createTogetheraiV4Middleware } from '@ai-billing/togetherai';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const togetherai = createTogetherAI({ apiKey: process.env.TOGETHER_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'openai/gpt-oss-20b': {
 *     promptTokens: 0.05 / 1_000_000,
 *     completionTokens: 0.2 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createTogetheraiV4Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: togetherai('openai/gpt-oss-20b'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createTogetheraiV4Middleware<TTags extends DefaultTags>(
  options: TogetheraiV4MiddlewareOptions<TTags>,
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
      const togetheraiRawUsage = usage?.raw as
        | TogetheraiV4UsageAccounting
        | undefined;

      const inputTokensTotal = togetheraiRawUsage?.prompt_tokens ?? 0;
      const outputTokensTotal = togetheraiRawUsage?.completion_tokens ?? 0;
      // Together AI's usage payload has no cache fields at all.
      const inputTokensCacheRead = 0;
      const inputTokensCacheWrite = 0;
      const outputTokensReasoning = togetheraiRawUsage?.reasoning_tokens ?? 0;

      const togetheraiUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'togetherai',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateTogetheraiCost({
        pricing,
        usage: togetheraiUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'togetherai',
        tags,
        usage: toUsage(togetheraiUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
