import Stripe from 'stripe';

let _stripe: Stripe | null = null;

function getStripeClient(): Stripe | null {
  if (_stripe) return _stripe;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) return null;

  _stripe = new Stripe(apiKey, {
    maxNetworkRetries: 3,
    timeout: 10000,
  });
  return _stripe;
}

export async function createStripeCustomer(
  email: string,
  userId: string,
): Promise<string | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;

  try {
    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });
    return customer.id;
  } catch (error) {
    console.error('[ai-billing] Failed to create Stripe customer:', error);
    return null;
  }
}

const stripeCustomerCache = new Map<string, string | null>();

export async function findStripeCustomerIdByUserId(
  userId: string,
): Promise<string | null> {
  const cached = stripeCustomerCache.get(userId);
  if (cached !== undefined) return cached;

  const stripe = getStripeClient();
  if (!stripe) return null;

  try {
    const { data } = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
      limit: 1,
    });
    const id = data[0]?.id ?? null;
    stripeCustomerCache.set(userId, id);
    return id;
  } catch (error) {
    console.error(
      '[ai-billing] Failed to find Stripe customer by userId:',
      error,
    );
    return null;
  }
}
