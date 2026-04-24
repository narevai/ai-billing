import { calculateMinimaxCost } from '../../../cost/index.js';
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

interface MinimaxAnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

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
 * Creates a V3 billing middleware for the Minimax provider (via `@ai-sdk/anthropic` with MiniMax base URL).
 * Maps AI SDK usage into billing fields and resolves cost from pricing plus usage.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link MinimaxV3MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V3 billing middleware instance for Minimax.
 *
 * @example
 * ```ts
 * import { createAnthropic } from '@ai-sdk/anthropic';
 * import { wrapLanguageModel } from 'ai';
 * import { createMinimaxMiddleware } from '@ai-billing/minimax';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const minimax = createAnthropic({
 *   apiKey: process.env.MINIMAX_API_KEY,
 *   baseURL: 'https://api.minimax.io/anthropic/v1',
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
 *   model: minimax('minimax-m1'),
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
      providerMetadata,
      responseId,
      tags,
      webSearchCount,
    }) => {
      const minimaxRawUsage = (providerMetadata as { anthropic?: { usage?: MinimaxAnthropicUsage } } | undefined)?.anthropic?.usage;

      const inputTokensTotal = minimaxRawUsage?.input_tokens ?? 0;
      const inputTokensCacheRead = minimaxRawUsage?.cache_read_input_tokens ?? 0;
      const inputTokensCacheWrite = minimaxRawUsage?.cache_creation_input_tokens ?? 0;
      const outputTokensText = minimaxRawUsage?.output_tokens ?? 0;
      const outputTokensReasoning = usage?.outputTokens?.reasoning ?? 0;

      const minimaxUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensText,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
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
        usage: toUsage(minimaxUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
