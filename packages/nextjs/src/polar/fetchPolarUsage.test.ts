import { describe, it, expect } from 'vitest';
import { fetchPolarUsage } from './fetchPolarUsage.js';

describe('fetchPolarUsage', () => {
  it('returns mocked usage data', async () => {
    const result = await fetchPolarUsage('user_1');
    expect(result).toEqual({
      consumedUnits: 12.5,
      creditedUnits: 50,
      meterName: 'Tokens',
      found: true,
    });
  });
});
