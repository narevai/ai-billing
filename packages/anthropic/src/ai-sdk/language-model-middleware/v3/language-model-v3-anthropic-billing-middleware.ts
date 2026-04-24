import { calculateAnthropicCost } from '../../../cost/index.js';
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

type AnthropicProviderMetadata = SharedV3ProviderMetadata & {
  anthropic?: AnthropicUsageAccounting;
};

/**
 * Configuration for {@link createAnthropicV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized OpenAI usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface AnthropicV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the Anthropic provider (`@ai-sdk/anthropic`).
 * Maps AI SDK usage into billing fields and resolves cost from pricing plus usage.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link AnthropicV3MiddlewareOptions}.
 * @returns A V3 billing middleware instance for Anthropic.
 *
 */
export function createAnthropicV3Middleware<TTags extends DefaultTags>(
  options: AnthropicV3MiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
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
