'use server';

import { Polar } from '@polar-sh/sdk';

/**
 * Creates a Polar checkout session and returns the URL.
 * @param productId - the Polar product ID
 * @param userId - the external customer ID
 * @param origin - the application origin for the success URL
 */
export async function createCheckout(
  productId: string,
  userId: string,
  origin: string,
) {
  const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    server: (process.env.POLAR_SERVER as 'sandbox' | 'production') ?? 'sandbox',
  });

  try {
    const checkout = await polar.checkouts.create({
      products: [productId],
      externalCustomerId: userId,
      successUrl: `${origin}/usage`,
    });
    return checkout.url;
  } catch (error) {
    console.error('Create checkout failed:', error);
    throw new Error('Failed to create checkout', { cause: error });
  }
}
