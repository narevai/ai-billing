export interface ModelPricing {
  promptTokens: number;
  completionTokens: number;
  inputCacheReadTokens?: number;
  inputCacheWriteTokens?: number;
  internalReasoningTokens?: number;
  request?: number;
  discount?: number;
}
