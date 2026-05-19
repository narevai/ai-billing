export async function fetchStripeUsage(
  _lookup: { stripeCustomerId: string } | { userId: string },
) {
  const m = globalThis.__SB__;
  if (m?.stripeUsageDelay === -1) return new Promise(() => {});
  if (m?.stripeUsageDelay)
    await new Promise(r => setTimeout(r, m.stripeUsageDelay));
  return m?.stripeUsage ?? { aggregatedValue: 0, found: false };
}
