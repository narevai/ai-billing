import { createBasePriceResolver } from './base-price-resolver.js';
import type {
  ModelPricing,
  PriceResolver,
  PriceResolverContext,
} from '../types/index.js';

export function createObjectPriceResolver(
  pricingMap: Record<string, ModelPricing>,
): PriceResolver {
  return createBasePriceResolver(({ modelId }: PriceResolverContext) => {
    return pricingMap[modelId];
  });
}
