import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../narev-client.js', () => ({
  getNarevClient: vi.fn(),
}));

import { getNarevClient } from '../narev-client.js';
import { fetchPolarUsage } from './fetchPolarUsage.js';
import { MOCK_POLAR_USAGE_DATA } from '../mock-billing-data.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchPolarUsage', () => {
  it('returns the mock usage data', async () => {
    const result = await fetchPolarUsage('user_1');
    expect(result).toEqual(MOCK_POLAR_USAGE_DATA);
  });

  it('returns a found, non-empty, contract-valid result', async () => {
    const result = await fetchPolarUsage('user_1');
    expect(result.found).toBe(true);
    expect(result.consumedUnits).toBeGreaterThanOrEqual(0);
    expect(result.creditedUnits).toBeGreaterThanOrEqual(0);
    expect(typeof result.meterName).toBe('string');
    expect(result.meterName.length).toBeGreaterThan(0);
  });

  it('does not call getNarevClient', async () => {
    await fetchPolarUsage('user_1');
    expect(getNarevClient).not.toHaveBeenCalled();
  });
});
