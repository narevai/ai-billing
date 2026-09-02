import { calculateAnthropicCost } from '../../../cost/index.js';
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
import { JSONObject, SharedV4ProviderMetadata } from '@ai-sdk/provider';

interface AnthropicUsageAccounting extends JSONObject {
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation?: {
      ephemeral_5m_input_tokens?: number;
      ephemeral_1h_input_tokens?: number;
    };
    service_tier?: string;
    inference_geo?: string;
  };
  cacheCreationInputTokens?: number;
  stopSequence?: string | null;
  iterations?: number | null;
}

type AnthropicProviderMetadata = SharedV4ProviderMetadata & {
  anthropic?: AnthropicUsageAccounting;
};

/**
 * Configuration for {@link createAnthropicV4Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized OpenAI usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface AnthropicV4MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V4 billing middleware for the Anthropic provider (`@ai-sdk/anthropic`).
 * Maps AI SDK usage into billing fields and resolves cost from pricing plus usage.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link AnthropicV4MiddlewareOptions}.
 * @returns A V4 billing middleware instance for Anthropic.
 *
 */
export function createAnthropicV4Middleware<TTags extends DefaultTags>(
  options: AnthropicV4MiddlewareOptions<TTags>,
) {
  return createV4BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage,
      providerMetadata,
      responseId,
      tags,
    }) => {
      const anthropicMetadata = providerMetadata as
        | AnthropicProviderMetadata
        | undefined;

      const anthropicRawUsage = anthropicMetadata?.anthropic?.usage;

      const inputTokensTotal =
        anthropicRawUsage?.input_tokens ?? usage?.inputTokens?.total ?? 0;
      const outputTokensTotal =
        anthropicRawUsage?.output_tokens ?? usage?.outputTokens?.text ?? 0;
      const cacheReadTokens =
        anthropicRawUsage?.cache_read_input_tokens ??
        usage?.inputTokens?.cacheRead ??
        0;
      const cacheWriteTokens =
        anthropicRawUsage?.cache_creation_input_tokens ??
        usage?.inputTokens?.cacheWrite ??
        0;
      const outputTokensReasoning = usage?.outputTokens?.reasoning ?? 0;

      const anthropicUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: cacheReadTokens,
        cacheWriteTokens: cacheWriteTokens,
        reasoningTokens: outputTokensReasoning,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'anthropic',
      } as PriceResolverContext);

      let calculatedCost: Cost | undefined = calculateAnthropicCost({
        pricing,
        usage: anthropicUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'anthropic',
        tags: tags,
        usage: toUsage(anthropicUsage),
        ...(calculatedCost !== undefined && {
          cost: calculatedCost,
        }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
