'use server';

import { Polar } from '@polar-sh/sdk';

export async function createCheckout(productId: string, userId: string, origin: string) {
  const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    server: (process.env.POLAR_SERVER as 'sandbox' | 'production') ?? 'sandbox',
  });

  const checkout = await polar.checkouts.create({
    products: [productId],
    externalCustomerId: userId,
    successUrl: `${origin}/usage`,
  });

  return checkout.url;
}
