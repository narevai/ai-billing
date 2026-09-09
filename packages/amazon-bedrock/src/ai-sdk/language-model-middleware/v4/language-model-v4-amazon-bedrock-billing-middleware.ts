import { calculateAmazonBedrockCost } from '../../../cost/index.js';
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

export interface AmazonBedrockV4UsageAccounting extends JSONObject {
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
  /** Present only when prompt caching is enabled for the underlying model/request. */
  cacheReadInputTokens?: number | null;
  cacheWriteInputTokens?: number | null;
  /**
   * Speculative/unused: AWS Bedrock's Converse API reports this for server-side tool invocations, but it
   * was empty (`{}`) in the sample capture and AWS does not support the Anthropic `web_search` server tool
   * on Bedrock. Kept for JSON round-tripping only; not mapped to any {@link CostInputs} field until a
   * confirmed shape/pricing semantic exists.
   */
  serverToolUsage?: JSONObject | null;
}

/**
 * Configuration for {@link createAmazonBedrockV4Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface AmazonBedrockV4MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V4 billing middleware for the Amazon Bedrock provider (`@ai-sdk/amazon-bedrock`).
 * Bills the full `inputTokens` at the prompt rate and adds cache-read/cache-write cost on top — Bedrock's
 * Converse API reports `inputTokens` excluding cached tokens, unlike providers whose prompt-token count
 * already includes them.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link AmazonBedrockV4MiddlewareOptions}. A `priceResolver` is
 * required.
 * @returns A V4 billing middleware instance for Amazon Bedrock.
 *
 * @example
 * ```ts
 * import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
 * import { wrapLanguageModel } from 'ai';
 * import { createAmazonBedrockV4Middleware } from '@ai-billing/amazon-bedrock';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const amazonBedrock = createAmazonBedrock({
 *   region: process.env.AWS_REGION,
 * });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'us.amazon.nova-lite-v1:0': {
 *     promptTokens: 0.06 / 1_000_000,
 *     completionTokens: 0.24 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createAmazonBedrockV4Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: amazonBedrock('us.amazon.nova-lite-v1:0'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createAmazonBedrockV4Middleware<TTags extends DefaultTags>(
  options: AmazonBedrockV4MiddlewareOptions<TTags>,
) {
  return createV4BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage,
      providerMetadata: _empty,
      responseId,
      tags,
    }) => {
      const amazonBedrockRawUsage = usage?.raw as
        | AmazonBedrockV4UsageAccounting
        | undefined;

      const inputTokensTotal = amazonBedrockRawUsage?.inputTokens ?? 0;
      const outputTokensTotal = amazonBedrockRawUsage?.outputTokens ?? 0;
      const inputTokensCacheRead =
        amazonBedrockRawUsage?.cacheReadInputTokens ?? 0;
      const inputTokensCacheWrite =
        amazonBedrockRawUsage?.cacheWriteInputTokens ?? 0;
      // No confirmed field for reasoning tokens in Bedrock's Converse usage payload.
      const outputTokensReasoning = 0;

      const amazonBedrockUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
        reasoningTokens: outputTokensReasoning,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'amazon-bedrock',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateAmazonBedrockCost({
        pricing,
        usage: amazonBedrockUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'amazon-bedrock',
        tags,
        usage: toUsage(amazonBedrockUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
