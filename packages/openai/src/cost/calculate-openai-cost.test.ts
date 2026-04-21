import { describe, it, expect } from 'vitest';
import { calculateOpenAICost } from './calculate-openai-cost.js';
import type { ModelPricing } from '@ai-billing/core';

describe('calculateOpenAICost (Integration)', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateOpenAICost({
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

  it('should calculate the exact cost based on the real-world CSV data (gpt-5.4-nano)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.00000125,
      inputCacheReadTokens: 0,
      inputCacheWriteTokens: 0,
      request: 0,
    };

    const usage = {
      promptTokens: 21,
      completionTokens: 28,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateOpenAICost({ pricing: mockPricing, usage });

    // Expected logic check:
    // Prompt nanos: 0.0000002 * 1e9 * 21 = 4,200 nanos
    // Completion nanos: 0.00000125 * 1e9 * 28 = 35,000 nanos
    // Total nanos: 39,200
    // In USD: $0.0000392 (Matches upstream_inference_cost exactly)
    expect(result).toEqual({
      amount: 39200,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should handle caching and reasoning tokens correctly', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.000001,
      inputCacheReadTokens: 0.0000001, // 50% discount for cache reads
      inputCacheWriteTokens: 0.0000002,
      internalReasoningTokens: 0.000002, // Premium for reasoning
      request: 0.01, // Flat 1 cent per request (10,000,000 nanos)
    };

    const usage = {
      promptTokens: 10, // 10 * 200 = 2,000 nanos
      completionTokens: 5, // 5 * 1,000 = 5,000 nanos
      cacheReadTokens: 100, // 100 * 100 = 10,000 nanos
      cacheWriteTokens: 0, // 0
      reasoningTokens: 2, // 2 * 2,000 = 4,000 nanos
    };

    const result = calculateOpenAICost({ pricing: mockPricing, usage });

    // Total: 2,000 + 5,000 + 10,000 + 0 + 4,000 + 10,000,000 (request flat fee) = 10,021,000 nanos
    expect(result).toEqual({
      amount: 10021000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should fallback to completion token price if reasoning token price is undefined', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.000001, // $1.00 per 1M
    };

    const usage = {
      promptTokens: 0,
      completionTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 10, // Should use the 0.000001 completion price -> 10,000 nanos
    };

    const result = calculateOpenAICost({ pricing: mockPricing, usage });

    expect(result).toEqual({
      amount: 10000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should bill web search calls when webSearch price is set', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0,
      completionTokens: 0,
      webSearch: 0.03, // $0.03 per search = 30,000,000 nanos
    };

    const result = calculateOpenAICost({
      pricing: mockPricing,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        webSearchCount: 3,
      },
    });

    // 3 * 0.03 * 1e9 = 90,000,000 nanos
    expect(result).toEqual({
      amount: 90000000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should not add web search cost when webSearchCount is 0', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0,
      webSearch: 0.03,
    };

    const result = calculateOpenAICost({
      pricing: mockPricing,
      usage: {
        promptTokens: 10,
        completionTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        webSearchCount: 0,
      },
    });

    // Only prompt: 10 * 200 = 2,000 nanos
    expect(result).toEqual({ amount: 2000, unit: 'nanos', currency: 'USD' });
  });

  it('should apply a discount correctly if one is provided in pricing', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0,
      discount: 0.1, // 10% discount
    };

    const usage = {
      promptTokens: 100, // 100 * 200 nanos = 20,000 nanos
      completionTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateOpenAICost({ pricing: mockPricing, usage });

    // 20,000 nanos - 10% = 18,000 nanos
    expect(result).toEqual({
      amount: 18000,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
