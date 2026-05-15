export async function fetchStripeConfig() {
  return globalThis.__SB__?.stripeConfig ?? { meterId: 'mtr_test' };
}
