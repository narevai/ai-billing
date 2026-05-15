export async function createCheckout(
  _productId: string,
  _userId: string,
  _origin: string,
) {
  return (
    globalThis.__SB__?.checkoutUrl ?? 'https://checkout.example.com/success'
  );
}
