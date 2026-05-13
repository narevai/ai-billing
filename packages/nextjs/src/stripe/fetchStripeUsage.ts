'use server';

import { fetchStripeConfig } from './fetchStripeConfig.js';
import Stripe from 'stripe';
import type { StripeUsageData } from './types.js';

export async function fetchStripeUsage(stripeCustomerId: string): Promise<StripeUsageData> {
  const empty = { aggregatedValue: 0, found: false };

  const config = await fetchStripeConfig();
  if (!config || !config.meterId) return empty;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const end = new Date();

  try {
    const summaries = await stripe.billing.meters.listEventSummaries(config.meterId, {
      customer: stripeCustomerId,
      start_time: Math.floor(start.getTime() / 1000),
      end_time: Math.floor(end.getTime() / 1000),
    });
    let aggregatedValue = 0;
    for (const s of summaries.data) aggregatedValue += s.aggregated_value;
    return { aggregatedValue: aggregatedValue / 1_000_000_000, found: true };
  } catch (error) {
    console.error('fetchStripeUsage:', error);
  }

  return empty;
}
