import { calculateChutesCost } from '../../../cost/index.js';
import { createV3BillingMiddleware, toUsage } from '@ai-billing/core';
import type { CostInputs } from '@ai-billing/core';
import type {
  BaseBillingMiddlewareOptions,
  PriceResolver,
  Cost,
  DefaultTags,
  PriceResolverContext,
  ModelPricing,
  BillingEvent,
} from '@ai-billing/core';

/**
 * Configuration for {@link createChutesV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface ChutesV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the Chutes provider (`llm.chutes.ai` via `@ai-sdk/openai-compatible`).
 * Deducts cache-read tokens from prompt tokens before billing — Chutes charges only non-cached input at the
 * prompt rate, and cached tokens separately at the cache-read rate.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link ChutesV3MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V3 billing middleware instance for Chutes.
 *
 * @example
 * ```ts
 * import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
 * import { wrapLanguageModel } from 'ai';
 * import { createChutesMiddleware } from '@ai-billing/chutes';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 * const chutes = createOpenAICompatible({
 *   name: 'chutes',
 *   baseURL: 'https://llm.chutes.ai/v1',
 *   apiKey: process.env.CHUTES_API_KEY,
 * });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'deepseek-ai/DeepSeek-V3-0324': {
 *     promptTokens: 0.27 / 1_000_000,
 *     completionTokens: 1.10 / 1_000_000,
 *     inputCacheReadTokens: 0.07 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createChutesMiddleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: chutes('deepseek-ai/DeepSeek-V3-0324'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createChutesV3Middleware<TTags extends DefaultTags>(
  options: ChutesV3MiddlewareOptions<TTags>,
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
      const inputTokensTotal = usage?.inputTokens?.total ?? 0;
      const inputTokensCacheRead = usage?.inputTokens?.cacheRead ?? 0;
      const outputTokensTotal = usage?.outputTokens?.total ?? 0;
      const outputTokensReasoning = usage?.outputTokens?.reasoning ?? 0;

      const chutesUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: usage?.inputTokens?.cacheWrite ?? 0,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'chutes',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateChutesCost({
        pricing,
        usage: chutesUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'chutes',
        tags,
        usage: toUsage(chutesUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
