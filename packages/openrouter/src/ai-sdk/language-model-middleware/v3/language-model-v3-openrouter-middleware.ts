import {
  AiBillingExtractError,
  LanguageModelV3BillingMiddleware,
} from '@ai-billing/core';
import type { BillingDestinationConfig } from '@ai-billing/core';
import type { OpenRouterUsageAccounting } from '@openrouter/ai-sdk-provider';

export interface OpenRouterProviderMetadata {
  openrouter?: {
    provider?: string;
    usage?: OpenRouterUsageAccounting;
  };
}

export class OpenRouterBillingMiddlewareV3 extends LanguageModelV3BillingMiddleware<OpenRouterProviderMetadata> {
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
    const usage = openrouterMeta?.usage;

    if (!usage || typeof usage.cost !== 'number' || isNaN(usage.cost)) {
      throw new AiBillingExtractError({
        provider: 'openrouter',
        message: `Expected 'usage.cost' to be a valid number.`,
        metadata: openrouterMeta,
      });
    }

    return {
      cost: usage.cost,
      genId,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
    };
  }
}
