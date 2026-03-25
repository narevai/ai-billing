import { LanguageModelV3BillingMiddleware } from '@ai-billing/core';
import type { BillingDestinationConfig } from '@ai-billing/core';

export interface OpenRouterProviderMetadata {
  openrouter?: {
    cost?: number;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    [key: string]: unknown;
  };
}

export class OpenRouterBillingMiddleware extends LanguageModelV3BillingMiddleware<OpenRouterProviderMetadata> {
  constructor(config: BillingDestinationConfig = {}) {
    super(config);
  }

  protected extractBilling(
    metadata: OpenRouterProviderMetadata | undefined,
    responseId: string | undefined,
    modelId: string,
    provider: string,
  ) {
    const genId = responseId ?? crypto.randomUUID();
    const openrouterMeta = metadata?.openrouter;

    if (
      !openrouterMeta ||
      typeof openrouterMeta.cost !== 'number' ||
      isNaN(openrouterMeta.cost)
    ) {
      return null;
    }

    return {
      cost: openrouterMeta.cost,
      genId,
      promptTokens: openrouterMeta.usage?.prompt_tokens,
      completionTokens: openrouterMeta.usage?.completion_tokens,
      totalTokens: openrouterMeta.usage?.total_tokens,
    };
  }
}
