import { calculateAmazonBedrockCost } from '../../../cost/index.js';
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

export interface AmazonBedrockV3UsageAccounting extends JSONObject {
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
 * Configuration for {@link createAmazonBedrockV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface AmazonBedrockV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the Amazon Bedrock provider (`@ai-sdk/amazon-bedrock`).
 * Bills the full `inputTokens` at the prompt rate and adds cache-read/cache-write cost on top — Bedrock's
 * Converse API reports `inputTokens` excluding cached tokens, unlike providers whose prompt-token count
 * already includes them.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link AmazonBedrockV3MiddlewareOptions}. A `priceResolver` is
 * required.
 * @returns A V3 billing middleware instance for Amazon Bedrock.
 *
 * @example
 * ```ts
 * import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
 * import { wrapLanguageModel } from 'ai';
 * import { createAmazonBedrockV3Middleware } from '@ai-billing/amazon-bedrock';
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
 * const billingMiddleware = createAmazonBedrockV3Middleware({
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
export function createAmazonBedrockV3Middleware<TTags extends DefaultTags>(
  options: AmazonBedrockV3MiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage,
      providerMetadata: _empty,
      responseId,
      tags,
    }) => {
      const amazonBedrockRawUsage = usage?.raw as
        | AmazonBedrockV3UsageAccounting
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
