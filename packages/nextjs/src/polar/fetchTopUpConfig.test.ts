import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../narev-client.js', () => ({
  getNarevClient: vi.fn(),
}));

import { getNarevClient } from '../narev-client.js';
import { fetchTopUpConfig } from './fetchTopUpConfig.js';
import {
  MOCK_CREDIT_PACKAGES,
  MOCK_TAX_BEHAVIOR,
} from '../mock-billing-data.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchTopUpConfig', () => {
  it('returns the mock packages and tax behavior', async () => {
    const result = await fetchTopUpConfig();
    expect(result.packages).toEqual(MOCK_CREDIT_PACKAGES);
    expect(result.taxBehavior).toBe(MOCK_TAX_BEHAVIOR);
  });

  it('returns a non-empty, contract-valid package list', async () => {
    const result = await fetchTopUpConfig();
    expect(result.packages.length).toBeGreaterThan(0);
    for (const pkg of result.packages) {
      expect(typeof pkg.id).toBe('string');
      expect(pkg.credits).toBeGreaterThan(0);
      expect(pkg.priceCents).toBeGreaterThan(0);
    }
  });

  it('does not call getNarevClient', async () => {
    await fetchTopUpConfig();
    expect(getNarevClient).not.toHaveBeenCalled();
  });
});
