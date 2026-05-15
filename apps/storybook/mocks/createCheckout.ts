export async function createCheckout(
  _productId: string,
  _userId: string,
  _origin: string,
) {
  const url = globalThis.__SB__?.checkoutUrl;
  // If no URL configured: 2s "Processing…" then back to normal, no navigation
  if (!url)
    return new Promise<string>(resolve => setTimeout(() => resolve('#'), 2000));
  return url;
}
