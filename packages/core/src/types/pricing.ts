export interface ModelPricing {
  promptTokens: number;
  completionTokens: number;
  inputCacheReadTokens?: number;
  inputCacheWriteTokens?: number;
  internalReasoningTokens?: number;
  request?: number;
  discount?: number;
}

export type PriceResolverContext = {
  modelId: string;
  providerId?: string;
  subProviderId?: string;
  quantization?: string;
};

export type PriceResolver = (
  context: PriceResolverContext,
) => Promise<ModelPricing | undefined>;
