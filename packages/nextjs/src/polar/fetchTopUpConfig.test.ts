import { describe, it, expect } from 'vitest';
import { fetchTopUpConfig } from './fetchTopUpConfig.js';

describe('fetchTopUpConfig', () => {
  it('returns mocked top-up config', async () => {
    const result = await fetchTopUpConfig();
    expect(result.packages).toEqual([
      { id: 'mock_1', credits: 1000, priceCents: 1000 },
    ]);
    expect(result.taxBehavior).toBe('exclusive');
  });
});