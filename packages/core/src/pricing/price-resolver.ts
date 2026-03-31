import type { ModelPricing } from '../types/index.js';

export type PriceResolver = (context: {
  modelId: string;
  subProviderId?: string;
  quantization?: string;
  supportedParameters?: string[];
}) => Promise<ModelPricing | undefined>;
