'use server';

import { getNarevClient } from '../narev-client.js';

/**
 * Creates a checkout session via Narev and returns the URL.
 * @param productId - the credit package product ID
 * @param userId - the end-user ID
 * @param origin - the application origin for the success URL
 */
export async function createCheckout(
  productId: string,
  userId: string,
  origin: string,
) {
  try {
    const client = getNarevClient();
    const response = await client.createCheckout({
      productId,
      userId,
      successUrl: `${origin}/usage`,
    });
    return response.data.url;
  } catch (error) {
    console.error('Create checkout failed:', error);
    throw new Error('Failed to create checkout', { cause: error });
  }
}
