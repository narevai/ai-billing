import { wrapLanguageModel } from 'ai';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { createGatewayV3Middleware } from '@ai-billing/gateway';
import { createStripeDestination } from '@ai-billing/stripe';
import { isTestEnvironment } from '@/lib/constants';

let _billingMiddleware: ReturnType<typeof createGatewayV3Middleware> | null =
  null;
let _initAttempted = false;

function getBillingMiddleware() {
  if (_initAttempted) return _billingMiddleware;
  _initAttempted = true;

  if (isTestEnvironment) return null;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  const destinations: ReturnType<typeof createStripeDestination>[] = [];

  if (stripeSecretKey) {
    const stripeDestination = createStripeDestination({
      apiKey: stripeSecretKey,
      meterName: 'llm_usage',
    });
    destinations.push(stripeDestination);
  }

  if (destinations.length === 0) return null;

  _billingMiddleware = createGatewayV3Middleware({
    destinations,
  });

  return _billingMiddleware;
}

export function getBillingWrappedModel(
  model: LanguageModelV3,
): LanguageModelV3 {
  const middleware = getBillingMiddleware();
  if (!middleware) return model;
  return wrapLanguageModel({ model, middleware });
}
