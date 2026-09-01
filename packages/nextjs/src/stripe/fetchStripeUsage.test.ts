import { describe, it, expect } from 'vitest';
import { fetchStripeUsage } from './fetchStripeUsage.js';

describe('fetchStripeUsage', () => {
  it('returns mocked usage data', async () => {
    const result = await fetchStripeUsage({ stripeCustomerId: 'cus_1' });
    expect(result).toEqual({ aggregatedValue: 12.5, found: true });
  });
});