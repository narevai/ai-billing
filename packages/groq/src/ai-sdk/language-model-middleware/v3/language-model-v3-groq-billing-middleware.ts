import { calculateGroqCost } from '../../../cost/index.js';
import type { GroqCostInputs } from '../../../cost/calculate-groq-cost.js';
import { createV3BillingMiddleware } from '@ai-billing/core';
import type {
  BaseBillingMiddlewareOptions,
  PriceResolver,
  Cost,
  DefaultTags,
  PriceResolverContext,
  ModelPricing,
  BillingEvent,
} from '@ai-billing/core';

interface GroqRawUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;

  prompt_tokens_details?: {
    cached_tokens?: number;
  };

  completion_tokens_details?: {
    reasoning_tokens?: number;
  };

  // Groq-specific timing metrics
  queue_time?: number;
  prompt_time?: number;
  completion_time?: number;
  total_time?: number;
}

/**
 * Configuration for {@link createGroqV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the Groq response; cost is computed from that usage
 * and the resolved {@link ModelPricing} using the same rules as the package's cost helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface GroqV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the Groq provider (`@ai-sdk/groq`).
 * Derives token usage from Groq's raw usage payload and resolves cost from pricing plus usage.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link GroqV3MiddlewareOptions}. A `priceResolver` is required
 * because Groq does not supply billed amounts in provider metadata the way the AI Gateway does.
 * @returns A V3 billing middleware instance for Groq.
 *
 * @example
 * Same wiring as `examples/dev-sandbox/app/api/groq` (`createGroqMiddleware` is this function's export alias
 * from `@ai-billing/groq`).
 *
 * ```ts
 * import { createGroq } from '@ai-sdk/groq';
 * import { wrapLanguageModel } from 'ai';
 * import { createGroqMiddleware } from '@ai-billing/groq';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'openai/gpt-oss-120b': {
 *     promptTokens: 0.15 / 1_000_000,
 *     completionTokens: 0.6 / 1_000_000,
 *     inputCacheReadTokens: 0.075 / 1_000_000,
 *     inputCacheWriteTokens: 0,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createGroqMiddleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: groq('openai/gpt-oss-120b'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createGroqV3Middleware<TTags extends DefaultTags>(
  options: GroqV3MiddlewareOptions<TTags>,
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
      const rawUsage = usage?.raw as GroqRawUsage | undefined;

      const totalInput = rawUsage?.prompt_tokens ?? 0;
      const inputTokensCacheRead =
        rawUsage?.prompt_tokens_details?.cached_tokens ?? 0;

      const totalOutput = rawUsage?.completion_tokens ?? 0;
      const outputTokensReasoning =
        rawUsage?.completion_tokens_details?.reasoning_tokens ?? 0;

      const inputTokensTotal = Math.max(0, totalInput - inputTokensCacheRead);
      const outputTokensTotal = Math.max(
        0,
        totalOutput - outputTokensReasoning,
      );

      const groqUsage: GroqCostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: 0,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'groq',
      } as PriceResolverContext);

      let calculatedCost: Cost | undefined = calculateGroqCost({
        pricing,
        usage: groqUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'groq',
        tags: tags,
        usage: {
          inputTokens: inputTokensTotal,
          outputTokens: outputTokensTotal,
          cacheReadTokens: inputTokensCacheRead,
          cacheWriteTokens: 0,
          reasoningTokens: outputTokensReasoning,
          totalTokens: inputTokensTotal + outputTokensTotal,
          webSearchCount: webSearchCount,
        },
        ...(calculatedCost !== undefined && {
          cost: calculatedCost,
        }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
