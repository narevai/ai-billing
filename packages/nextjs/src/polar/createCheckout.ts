'use server';

/**
 * Returns a mock checkout URL for a credit package purchase.
 *
 * The Narev checkout endpoint (`POST /v1/credit`) this action used to call
 * no longer exists. Until a replacement backend is available this safely
 * returns the passed-in `successUrl` instead of making a network call, so
 * the caller's redirect flow keeps working harmlessly.
 * @param productId - the credit package product ID
 * @param userId - the end-user ID
 * @param successUrl - URL to redirect after successful purchase
 */
export async function createCheckout(
  productId: string,
  userId: string,
  successUrl: string,
): Promise<string> {
  void productId;
  void userId;
  return successUrl;
}
