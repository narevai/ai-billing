import { describe, it, expect } from 'vitest';
import { calculateGoogleCost } from './calculate-google-cost.js';
import type { ModelPricing } from '@ai-billing/core';

describe('calculateGoogleCost (Integration)', () => {
  const actualPricing: ModelPricing = {
    promptTokens: 0.000002, // $2.00 per 1M
    completionTokens: 0.000012, // $12.00 per 1M
    inputCacheReadTokens: 0.0000002, // $0.20 per 1M
    inputCacheWriteTokens: 0.000000375, // $0.375 per 1M
    internalReasoningTokens: 0.000012, // $12.00 per 1M (Same as completion)
    request: 0,
    discount: 0,
  };

  it('should return undefined if no pricing is provided', () => {
    const result = calculateGoogleCost({
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

  it('should calculate the exact cost based on real-world Gemini 3.1 Pro telemetry', () => {
    const usage = {
      promptTokens: 16,
      completionTokens: 396, // Includes the 342 reasoning tokens
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 342, // Note: Implementation must ensure this isn't double-billed
    };
    const result = calculateGoogleCost({ pricing: actualPricing, usage });

    // Expected logic check:
    // Prompt nanos: 0.000002 * 1e9 * 16 = 32,000 nanos ($0.000032)
    // Completion nanos: 0.000012 * 1e9 * 396 = 4,752,000 nanos ($0.004752)
    // Total nanos: 4,784,000
    // In USD: $0.004784
    expect(result).toEqual({
      amount: 4784000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should handle caching and reasoning tokens correctly', () => {
    const usage = {
      promptTokens: 100, // 100 * $0.000002 = $0.0002 (200,000 nanos)
      completionTokens: 50, // 50 * $0.000012 = $0.0006 (600,000 nanos)
      cacheReadTokens: 1000, // 1000 * $0.0000002 = $0.0002 (200,000 nanos)
      cacheWriteTokens: 2000, // 2000 * $0.000000375 = $0.000750 (750,000 nanos)
      reasoningTokens: 0,
    };

    const result = calculateGoogleCost({ pricing: actualPricing, usage });

    // Total: 200,000 + 600,000 + 200,000 + 750,000 = 1,750,000 nanos ($0.00175)
    expect(result).toEqual({
      amount: 1750000,
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

    const result = calculateGoogleCost({
      pricing: mockPricing,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        webSearchCount: 2,
      },
    });

    // 2 * 0.03 * 1e9 = 60,000,000 nanos
    expect(result).toEqual({
      amount: 60000000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should apply a discount correctly if one is provided in pricing', () => {
    const discountedPricing: ModelPricing = {
      ...actualPricing,
      discount: 0.5, // 50% discount
    };

    const usage = {
      promptTokens: 1000, // 1000 * $0.000002 = $0.002 (2,000,000 nanos)
      completionTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateGoogleCost({ pricing: discountedPricing, usage });

    expect(result).toEqual({
      amount: 1000000,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
