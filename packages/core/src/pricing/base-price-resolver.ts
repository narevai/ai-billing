import type {
  ModelPricing,
  PriceResolver,
  PriceResolverContext,
} from '../types/index.js';

export function createBasePriceResolver(
  handler: (
    context: PriceResolverContext,
  ) => ModelPricing | undefined | Promise<ModelPricing | undefined>,
): PriceResolver {
  return async (context: PriceResolverContext) => {
    return handler(context);
  };
}
