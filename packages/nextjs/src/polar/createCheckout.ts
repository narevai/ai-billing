'use server';

/**
 * Creates a checkout session and returns the URL. (Mocked implementation)
 * @param _productId - the credit package product ID
 * @param _userId - the end-user ID
 * @param _successUrl - URL to redirect after successful purchase
 */
export async function createCheckout(
  _productId: string,
  _userId: string,
  _successUrl: string,
) {
  return 'https://sandbox.polar.sh/mock-checkout';
}
