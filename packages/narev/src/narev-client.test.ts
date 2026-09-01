import { describe, it, expect } from 'vitest';
import { createNarevClient } from './narev-client.js';

describe('NarevClient', () => {
  describe('getBalance', () => {
    it('returns mocked balance with base unit for userId', async () => {
      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.getBalance({ userId: 'user_123' });

      expect(result).toEqual({
        data: {
          unitsBalance: 1000000000,
          unitsConsumed: 1000,
          unitsCredited: 1000000000,
          unit: 'base',
          currency: 'USD',
          meterName: 'Usage',
          found: true,
        },
      });
    });

    it('returns mocked balance with nanos unit for stripeCustomerId', async () => {
      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.getBalance({ stripeCustomerId: 'cus_abc' });

      expect(result).toEqual({
        data: {
          unitsBalance: null,
          unitsConsumed: 1000,
          unitsCredited: null,
          unit: 'nanos',
          currency: 'USD',
          meterName: 'Usage',
          found: true,
        },
      });
    });
  });

  describe('getCreditConfig', () => {
    it('returns mocked credit config', async () => {
      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.getCreditConfig();

      expect(result).toEqual({
        data: {
          packages: [
            { id: 'prod_1', credits: 100, priceCents: 1000 },
            { id: 'prod_2', credits: 500, priceCents: 4500 },
          ],
          taxBehavior: 'exclusive',
        },
      });
    });
  });

  describe('createCheckout', () => {
    it('returns mocked checkout response', async () => {
      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.createCheckout({
        productId: 'prod_1',
        userId: 'user_123',
        successUrl: 'https://myapp.com/success',
      });

      expect(result).toEqual({
        data: { url: 'https://mock.checkout.url/sess_mock' },
      });
    });
  });

  describe('listModels', () => {
    it('returns mocked models list', async () => {
      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.listModels();

      expect(result).toEqual({
        data: [
          { provider_id: 'openai', model_id: 'gpt-4o' },
          { provider_id: 'anthropic', model_id: 'claude-3-5-haiku-latest' },
        ],
        meta: { page: 1, page_size: 100, total: 2, total_pages: 1 },
      });
    });
  });

  describe('listProviders', () => {
    it('returns mocked providers list', async () => {
      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.listProviders();

      expect(result).toEqual({
        data: [
          { provider_id: 'openai', name: 'OpenAI' },
          { provider_id: 'anthropic', name: 'Anthropic' },
        ],
      });
    });
  });

  describe('listPrices', () => {
    it('returns mocked prices list', async () => {
      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.listPrices();

      expect(result).toEqual({
        data: [],
        meta: { page: 1, page_size: 100, total: 0, total_pages: 0 },
      });
    });
  });

  describe('searchPrices', () => {
    it('returns mocked searched prices', async () => {
      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.searchPrices({
        q: 'gpt-4',
        provider_id: 'openai',
      });

      expect(result).toEqual({
        data: [],
        meta: { page: 1, page_size: 100, total: 0, total_pages: 0 },
      });
    });
  });

  describe('calculateCost', () => {
    it('returns mocked trace cost calculation', async () => {
      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.calculateCost({
        model_id: 'gpt-4o',
        provider_id: 'openai',
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      });

      expect(result).toEqual({
        model_id: 'gpt-4o',
        provider_id: 'openai',
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
        pricing: {
          prompt: 0,
          completion: 0,
          discount: 0,
          request: 0,
          web_search: 0,
          input_cache_read: 0,
          input_cache_write: 0,
          image: 0,
          image_output: 0,
          audio: 0,
          audio_output: 0,
          input_audio_cache: 0,
          internal_reasoning: 0,
        },
        cost_breakdown: { total: 0 },
      });
    });
  });
});
