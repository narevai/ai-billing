'use server';

import type { NarevPolarConfig } from './types.js';

/** Fetches Polar billing configuration from the Narev API */
export async function fetchPolarConfig(): Promise<NarevPolarConfig | null> {
  try {
    const key = process.env.NAREV_API_KEY;
    if (!key) {
      console.error('fetchPolarConfig: NAREV_API_KEY is not set');
      return null;
    }

    const res = await fetch('https://www.narev.ai/api/billing-target/polar', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.error(
        `fetchPolarConfig: Narev returned ${res.status} ${res.statusText}`,
      );
      return null;
    }
    const json = await res.json();
    return json.data as NarevPolarConfig;
  } catch (error) {
    console.error('fetchPolarConfig:', error);
    return null;
  }
}
