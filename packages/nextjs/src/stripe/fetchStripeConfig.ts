'use server';

import type { StripeConfig } from './types.js';

/** Fetches Stripe billing configuration from the Narev API */
export async function fetchStripeConfig(): Promise<StripeConfig | null> {
  try {
    const key = process.env.NAREV_API_KEY;
    if (!key) {
      console.error('fetchStripeConfig: NAREV_API_KEY is not set');
      return null;
    }

    const res = await fetch('https://www.narev.ai/api/billing-target/stripe', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.error(
        `fetchStripeConfig: Narev returned ${res.status} ${res.statusText}`,
      );
      return null;
    }
    const json = await res.json();
    return json.data as StripeConfig;
  } catch (error) {
    console.error('fetchStripeConfig:', error);
    return null;
  }
}
