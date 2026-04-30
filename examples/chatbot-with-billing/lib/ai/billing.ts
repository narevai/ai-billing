import { wrapLanguageModel } from 'ai';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { createGatewayV3Middleware } from '@ai-billing/gateway';
import { createPolarDestination } from '@ai-billing/polar';
import { isTestEnvironment } from '@/lib/constants';

let _billingMiddleware: ReturnType<typeof createGatewayV3Middleware> | null =
  null;
let _initAttempted = false;

function getBillingMiddleware() {
  if (_initAttempted) return _billingMiddleware;
  _initAttempted = true;

  if (isTestEnvironment) return null;

  const polarAccessToken = process.env.POLAR_ACCESS_TOKEN;
  const polarServer = process.env.POLAR_SERVER as
    | 'sandbox'
    | 'production'
    | undefined;

  const destinations: ReturnType<typeof createPolarDestination>[] = [];

  if (polarAccessToken) {
    const polarDestination = createPolarDestination({
      accessToken: polarAccessToken,
      server: polarServer ?? 'sandbox',
      eventName: 'llm_usage',
      externalCustomerIdKey: 'userId',
    });
    destinations.push(polarDestination);
  }

  if (destinations.length === 0) return null;

  _billingMiddleware = createGatewayV3Middleware({
    destinations,
  });

  return _billingMiddleware;
}

export function getBillingWrappedModel(model: LanguageModelV3): LanguageModelV3 {
  const middleware = getBillingMiddleware();
  if (!middleware) return model;
  return wrapLanguageModel({ model, middleware });
}
