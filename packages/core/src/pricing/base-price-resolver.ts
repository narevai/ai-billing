import type {
  ModelPricing,
  PriceResolver,
  PriceResolverContext,
} from '../types/index.js';

/**
 * Creates a base price resolver that wraps a handler function.
 * @param handler The function that resolves model pricing.
 * @returns A price resolver that wraps the handler function.
 */
export function createBasePriceResolver(
  handler: (
    context: PriceResolverContext,
  ) => ModelPricing | undefined | Promise<ModelPricing | undefined>,
): PriceResolver {
  return async (context: PriceResolverContext) => {
    return handler(context);
  };
}
