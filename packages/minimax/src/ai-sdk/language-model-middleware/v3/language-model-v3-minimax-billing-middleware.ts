import { calculateMinimaxCost } from '../../../cost/index.js';
import { createV3BillingMiddleware } from '@ai-billing/core';
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
 * Configuration for {@link createMinimaxV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface MinimaxV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the Minimax provider (via `@ai-sdk/openai-compatible`).
 * Maps AI SDK usage into billing fields and resolves cost from pricing plus usage.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link MinimaxV3MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V3 billing middleware instance for Minimax.
 *
 * @example
 * ```ts
 * import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
 * import { wrapLanguageModel } from 'ai';
 * import { createMinimaxMiddleware } from '@ai-billing/minimax';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 * import type { LanguageModelV3 } from '@ai-sdk/provider';
 *
 * const minimax = createOpenAICompatible({
 *   name: 'minimax',
 *   baseURL: 'https://api.minimax.chat/v1',
 *   apiKey: process.env.MINIMAX_API_KEY,
 * });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'minimax-m1': {
 *     promptTokens: 0.4 / 1_000_000,
 *     completionTokens: 1.6 / 1_000_000,
 *     internalReasoningTokens: 1.6 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createMinimaxMiddleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: minimax('minimax-m1') as unknown as LanguageModelV3,
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createMinimaxV3Middleware<TTags extends DefaultTags>(
  options: MinimaxV3MiddlewareOptions<TTags>,
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

      const minimaxUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: usage?.inputTokens?.cacheWrite ?? 0,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'minimax',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateMinimaxCost({
        pricing,
        usage: minimaxUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'minimax',
        tags,
        usage: {
          inputTokens: inputTokensTotal,
          outputTokens: outputTokensTotal,
          cacheReadTokens: inputTokensCacheRead,
          cacheWriteTokens: usage?.inputTokens?.cacheWrite ?? 0,
          reasoningTokens: outputTokensReasoning,
          totalTokens: inputTokensTotal + outputTokensTotal,
          webSearchCount: webSearchCount,
        },
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
