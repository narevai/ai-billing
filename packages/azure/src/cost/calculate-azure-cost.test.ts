import { describe, it, expect } from 'vitest';
import { calculateAzureCost } from './calculate-azure-cost.js';
import type { ModelPricing } from '@ai-billing/types';

describe('calculateAzureCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateAzureCost({
      pricing: undefined,
      usage: {
        promptTokens: 10,
        completionTokens: 10,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
      },
    });

    expect(result).toBeUndefined();
  });

  it('should calculate cost for the sample Azure (AI Foundry) generate-text usage (input_tokens: 17, output_tokens: 10, cached_tokens: 0)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.0000006,
      inputCacheReadTokens: 0.00000005,
      request: 0,
    };

    const usage = {
      promptTokens: 17,
      completionTokens: 10,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateAzureCost({ pricing: mockPricing, usage });

    // Prompt: 0.0000002 * 1e9 * 17 = 3,400 nanos
    // Completion: 0.0000006 * 1e9 * 10 = 6,000 nanos
    // Total: 9,400 nanos
    expect(result).toEqual({
      amount: 9400,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should deduct cache-read and cache-write tokens from prompt tokens correctly (synthetic non-zero cache usage)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000002,
      completionTokens: 0.000006,
      inputCacheReadTokens: 0.000001,
      inputCacheWriteTokens: 0.0000015,
      request: 0,
    };

    const usage = {
      promptTokens: 100, // Total input_tokens
      completionTokens: 20,
      cacheReadTokens: 30, // Subset of input_tokens (cached_tokens)
      cacheWriteTokens: 10, // Subset of input_tokens (cache_write_tokens)
      reasoningTokens: 0,
    };

    const result = calculateAzureCost({ pricing: mockPricing, usage });

    // Prompt (non-cached): (100 - 30 - 10) = 60 * 0.000002 * 1e9 = 120,000 nanos
    // Cache read: 30 * 0.000001 * 1e9 = 30,000 nanos
    // Cache write: 10 * 0.0000015 * 1e9 = 15,000 nanos
    // Completion: 20 * 0.000006 * 1e9 = 120,000 nanos
    // Total: 120,000 + 30,000 + 15,000 + 120,000 = 285,000 nanos
    expect(result).toEqual({
      amount: 285000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should deduct reasoning tokens from completion tokens correctly (synthetic non-zero reasoning usage)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000003,
      completionTokens: 0.0000005,
      inputCacheReadTokens: 0.000000075,
      internalReasoningTokens: 0.0000008,
      request: 0,
    };

    const usage = {
      promptTokens: 22,
      completionTokens: 289,
      cacheReadTokens: 4,
      cacheWriteTokens: 0,
      reasoningTokens: 227,
    };

    const result = calculateAzureCost({ pricing: mockPricing, usage });

    // Prompt: 0.0000003 * 1e9 * (22 - 4) = 5,400 nanos
    // Completion: 0.0000005 * 1e9 * (289 - 227) = 31,000 nanos
    // Cache read: 0.000000075 * 1e9 * 4 = 300 nanos
    // Reasoning: 0.0000008 * 1e9 * 227 = 181,600 nanos
    // Total: 5,400 + 31,000 + 300 + 181,600 = 218,300 nanos
    expect(result).toEqual({
      amount: 218300,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should apply discount correctly', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000001,
      completionTokens: 0.000002,
      discount: 0.1,
    };

    const usage = {
      promptTokens: 1000,
      completionTokens: 500,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateAzureCost({ pricing: mockPricing, usage });

    // Gross: 0.000001 * 1e9 * 1000 + 0.000002 * 1e9 * 500 = 2,000,000 nanos
    // After 10% discount: 1,800,000 nanos
    expect(result).toEqual({
      amount: 1800000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should include web search cost when both pricing.webSearch and usage.webSearchCount are provided', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000001,
      completionTokens: 0.000003,
      request: 0,
      webSearch: 0.000005,
    };

    const usage = {
      promptTokens: 41,
      completionTokens: 26,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      webSearchCount: 3,
    };

    const result = calculateAzureCost({ pricing: mockPricing, usage });

    // Prompt: 0.000001 * 1e9 * 41 = 41,000 nanos
    // Completion: 0.000003 * 1e9 * 26 = 78,000 nanos
    // Web search: 0.000005 * 1e9 * 3 = 15,000 nanos
    // Total: 41,000 + 78,000 + 15,000 = 134,000 nanos
    expect(result).toEqual({
      amount: 134000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should include a flat request fee when pricing.request is set', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000001,
      completionTokens: 0.000003,
      request: 0.001,
    };

    const usage = {
      promptTokens: 10,
      completionTokens: 10,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateAzureCost({ pricing: mockPricing, usage });

    // Prompt: 0.000001 * 1e9 * 10 = 10,000 nanos
    // Completion: 0.000003 * 1e9 * 10 = 30,000 nanos
    // Request: 0.001 * 1e9 = 1,000,000 nanos
    // Total: 10,000 + 30,000 + 1,000,000 = 1,040,000 nanos
    expect(result).toEqual({
      amount: 1040000,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
