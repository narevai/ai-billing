import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../narev-client.js', () => ({
  getNarevClient: vi.fn(),
}));

import { getNarevClient } from '../narev-client.js';
import { fetchStripeUsage } from './fetchStripeUsage.js';
import { MOCK_STRIPE_USAGE_DATA } from '../mock-billing-data.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchStripeUsage', () => {
  it('returns the mock usage data for a userId lookup', async () => {
    const result = await fetchStripeUsage({ userId: 'user_1' });
    expect(result).toEqual(MOCK_STRIPE_USAGE_DATA);
  });

  it('returns the mock usage data for a stripeCustomerId lookup', async () => {
    const result = await fetchStripeUsage({ stripeCustomerId: 'cus_1' });
    expect(result).toEqual(MOCK_STRIPE_USAGE_DATA);
  });

  it('returns a found, non-empty, contract-valid result', async () => {
    const result = await fetchStripeUsage({ userId: 'user_1' });
    expect(result.found).toBe(true);
    expect(result.aggregatedValue).toBeGreaterThan(0);
  });

  it('does not call getNarevClient', async () => {
    await fetchStripeUsage({ userId: 'user_1' });
    expect(getNarevClient).not.toHaveBeenCalled();
  });
});
