import { calculateOpenAICompatibleCost } from '../../../cost/index.js';
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
 * Configuration for {@link createOpenAICompatibleV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * adds `priceResolver` plus `providerId`. Usage comes from the AI SDK's normalized usage fields for
 * OpenAI-compatible responses; cost is computed from that usage and the resolved {@link ModelPricing} using
 * the same rules as the package's cost helper.
 *
 * `providerId` must match the `name` you pass to `createOpenAICompatible` from `@ai-sdk/openai-compatible`
 * so {@link PriceResolver} calls and emitted `provider` on events stay aligned.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface OpenAICompatibleV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
  providerId: string;
}

/**
 * Creates a V3 billing middleware for OpenAI-compatible providers (for example `@ai-sdk/openai-compatible`).
 * Normalizes usage and resolves cost via your {@link PriceResolver}; billing events use `options.providerId`
 * as the provider.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link OpenAICompatibleV3MiddlewareOptions}.
 * @returns A V3 billing middleware instance for the configured provider.
 *
 * @example
 * Same wiring as `examples/dev-sandbox/app/api/openai-compatible` (`createOpenAICompatibleMiddleware` is this
 * function's export alias from `@ai-billing/openai-compatible`).
 *
 * ```ts
 * import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
 * import { wrapLanguageModel } from 'ai';
 * import { createOpenAICompatibleMiddleware } from '@ai-billing/openai-compatible';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 * import type { LanguageModelV3 } from '@ai-sdk/provider';
 *
 * const xai = createOpenAICompatible({
 *   name: 'xai', // must match `providerId` below
 *   baseURL: 'https://api.x.ai/v1',
 *   apiKey: process.env.XAI_API_KEY,
 *   includeUsage: true,
 * });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'grok-4-1-fast-reasoning': {
 *     promptTokens: 0.2 / 1_000_000,
 *     completionTokens: 0.5 / 1_000_000,
 *     internalReasoningTokens: 0,
 *     inputCacheReadTokens: 0.15 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createOpenAICompatibleMiddleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 *   providerId: 'xai',
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: xai('grok-4-1-fast-reasoning') as unknown as LanguageModelV3,
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createOpenAICompatibleV3Middleware<TTags extends DefaultTags>(
  options: OpenAICompatibleV3MiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({ model, usage, responseId, tags, webSearchCount }) => {
      const inputTokensTotal = usage?.inputTokens?.total ?? 0;
      const inputTokensCacheRead = usage?.inputTokens?.cacheRead ?? 0;
      const outputTokensTotal = usage?.outputTokens?.total ?? 0;
      const outputTokensReasoning = usage?.outputTokens?.reasoning ?? 0;

      const openAICompatibleUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: usage?.inputTokens?.cacheWrite ?? 0,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: options.providerId,
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateOpenAICompatibleCost({
        pricing,
        usage: openAICompatibleUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: options.providerId,
        tags,
        usage: toUsage(openAICompatibleUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
