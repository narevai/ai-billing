import { calculateOpenAICost } from '../../../cost/index.js';
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
import { JSONObject, SharedV3ProviderMetadata } from '@ai-sdk/provider';

interface OpenAIUsageAccounting extends JSONObject {
  acceptedPredictionTokens?: number;
  rejectedPredictionTokens?: number;
  logprobs?: number | boolean;
  serviceTier?: string;
}

type OpenAIProviderMetadata = SharedV3ProviderMetadata & {
  openai?: OpenAIUsageAccounting;
};

/**
 * Configuration for {@link createOpenAIV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized OpenAI usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface OpenAIV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the OpenAI provider (`@ai-sdk/openai`).
 * Maps AI SDK usage into billing fields and resolves cost from pricing plus usage.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link OpenAIV3MiddlewareOptions}.
 * @returns A V3 billing middleware instance for OpenAI.
 *
 * @example
 * Same wiring as `examples/dev-sandbox/app/api/openai` (`createOpenAIMiddleware` is this function's export
 * alias from `@ai-billing/openai`).
 *
 * ```ts
 * import { createOpenAI } from '@ai-sdk/openai';
 * import { wrapLanguageModel } from 'ai';
 * import { createOpenAIMiddleware } from '@ai-billing/openai';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'gpt-5': {
 *     promptTokens: 1.25 / 1_000_000,
 *     completionTokens: 10.0 / 1_000_000,
 *     inputCacheReadTokens: 0.125 / 1_000_000,
 *   },
 *   'gpt-4o': {
 *     promptTokens: 5.0 / 1_000_000,
 *     completionTokens: 15.0 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createOpenAIMiddleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: openai('gpt-5'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createOpenAIV3Middleware<TTags extends DefaultTags>(
  options: OpenAIV3MiddlewareOptions<TTags>,
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
      const _openaiMetadata = providerMetadata as
        | OpenAIProviderMetadata
        | undefined;

      const openAIUsage: CostInputs = {
        promptTokens: usage?.inputTokens?.total ?? 0,
        completionTokens: usage?.outputTokens?.text ?? 0,
        cacheReadTokens: usage?.inputTokens?.cacheRead ?? 0,
        cacheWriteTokens: usage?.inputTokens?.cacheWrite ?? 0,
        reasoningTokens: usage?.outputTokens?.reasoning ?? 0,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'openai',
      } as PriceResolverContext);

      let calculatedCost: Cost | undefined = calculateOpenAICost({
        pricing,
        usage: openAIUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'openai',
        tags: tags,
        usage: toUsage(openAIUsage),
        ...(calculatedCost !== undefined && {
          cost: calculatedCost,
        }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
