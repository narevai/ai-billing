export interface ModelPricing {
  promptTokens: number;
  completionTokens: number;
  inputCacheReadTokens?: number;
  inputCacheWriteTokens?: number;
  internalReasoningTokens?: number;
  request?: number;
  webSearch?: number;
  discount?: number;
}

export type PriceResolverContext = {
  modelId: string;
  providerId?: string;
  subProvider?: string;
  quantization?: string;
};

export type PriceResolver = (
  context: PriceResolverContext,
) => Promise<ModelPricing | undefined>;
