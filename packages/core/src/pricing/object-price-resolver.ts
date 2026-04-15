import { createBasePriceResolver } from './base-price-resolver.js';
import type {
  ModelPricing,
  PriceResolver,
  PriceResolverContext,
} from '../types/index.js';

/**
 * Creates a price resolver that uses a static pricing map.
 * @param pricingMap - A mapping of model IDs to model pricing.
 * @returns A price resolver that uses the static pricing map.
 */
export function createObjectPriceResolver(
  pricingMap: Record<string, ModelPricing>,
): PriceResolver {
  return createBasePriceResolver(({ modelId }: PriceResolverContext) => {
    return pricingMap[modelId];
  });
}
