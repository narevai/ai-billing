import { calculateHuggingfaceCost } from '../../../cost/index.js';
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

/**
 * Raw usage payload shape returned by `@ai-sdk/huggingface`. Hugging Face's Inference Providers go through
 * OpenAI's Responses API shape (not Chat Completions), so the raw usage block uses
 * `input_tokens`/`output_tokens` (totals) rather than `prompt_tokens`/`completion_tokens`, with
 * `input_tokens_details.cached_tokens` and `output_tokens_details.reasoning_tokens` as subsets of those
 * totals.
 */
export interface HuggingfaceV3UsageAccounting extends JSONObject {
  input_tokens: number;
  input_tokens_details?: {
    cached_tokens?: number | null;
  } | null;
  output_tokens: number;
  output_tokens_details?: {
    reasoning_tokens?: number | null;
  } | null;
  total_tokens: number;
}

/**
 * Configuration for {@link createHuggingfaceV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface HuggingfaceV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the Hugging Face provider (`@ai-sdk/huggingface`).
 * Deducts cache-read tokens from prompt tokens before billing — Hugging Face charges only non-cached input
 * at the prompt rate, and cached tokens separately at the cache-read rate.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link HuggingfaceV3MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V3 billing middleware instance for Hugging Face.
 *
 * @example
 * ```ts
 * import { createHuggingFace } from '@ai-sdk/huggingface';
 * import { wrapLanguageModel } from 'ai';
 * import { createHuggingfaceV3Middleware } from '@ai-billing/huggingface';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const huggingFace = createHuggingFace({ apiKey: process.env.HUGGINGFACE_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'meta-llama/Llama-3.1-8B-Instruct': {
 *     promptTokens: 0.05 / 1_000_000,
 *     completionTokens: 0.15 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createHuggingfaceV3Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: huggingFace('meta-llama/Llama-3.1-8B-Instruct'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createHuggingfaceV3Middleware<TTags extends DefaultTags>(
  options: HuggingfaceV3MiddlewareOptions<TTags>,
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
      const huggingfaceRawUsage = usage?.raw as
        | HuggingfaceV3UsageAccounting
        | undefined;

      const inputTokensTotal = huggingfaceRawUsage?.input_tokens ?? 0;
      const outputTokensTotal = huggingfaceRawUsage?.output_tokens ?? 0;
      const inputTokensCacheRead =
        huggingfaceRawUsage?.input_tokens_details?.cached_tokens ?? 0;
      const inputTokensCacheWrite = 0; // Hugging Face's Responses-API usage has no cache-write concept
      const outputTokensReasoning =
        huggingfaceRawUsage?.output_tokens_details?.reasoning_tokens ?? 0;

      const huggingfaceUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'huggingface',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateHuggingfaceCost({
        pricing,
        usage: huggingfaceUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'huggingface',
        tags,
        usage: toUsage(huggingfaceUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
