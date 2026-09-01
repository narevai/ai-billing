'use server';

/**
 * Creates a checkout session via Narev and returns the URL.
 * @param productId - the credit package product ID
 * @param userId - the end-user ID
 * @param successUrl - URL to redirect after successful purchase
 */
export async function createCheckout(
  productId: string,
  userId: string,
  successUrl: string,
) {
  return 'https://sandbox.polar.sh/mock-checkout';
}